// Ejecuta la migración real de Supabase en PostgreSQL (PGlite) y comprueba RLS y "gana la última escritura".
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
let pg: PGlite;

// Reproduce lo mínimo que Supabase trae de fábrica: esquema auth, auth.uid() y el rol authenticated.
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  grant usage on schema public, auth to authenticated;
  alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
  insert into auth.users values ('${A}'), ('${B}');
`;

async function como<T>(usuario: string, consulta: (db: PGlite) => Promise<T>): Promise<T> {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${usuario}', false);`);
  try { return await consulta(pg); } finally { await pg.exec('reset role;'); }
}

const card = (updatedAt: string, interval: number) => JSON.stringify([{
  question_id: 'mcp-mc1', interval_days: interval, ease: 2.5, repetitions: 1,
  due_date: '2026-11-02', first_seen: '2026-11-01', updated_at: updatedAt
}]);

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  await pg.exec(readFileSync(new URL('../supabase/migrations/001_init.sql', import.meta.url), 'utf8'));
}, 60_000);

describe('migración SQL de Supabase', () => {
  it('cada usuario solo ve sus propios repasos', async () => {
    await como(A, db => db.query(
      `insert into review_logs (id, question_id, topic_id, rating, correct, seconds, study_date)
       values (gen_random_uuid(), 'mcp-mc1', 'mcp', 'bien', true, 5, '2026-11-01')`));
    const deA = await como(A, db => db.query('select * from review_logs'));
    const deB = await como(B, db => db.query('select * from review_logs'));
    expect(deA.rows).toHaveLength(1);
    expect(deB.rows).toHaveLength(0);
  });

  it('no se pueden insertar datos a nombre de otro usuario', async () => {
    await expect(como(B, db => db.query(
      `insert into review_logs (id, user_id, question_id, topic_id, rating, correct, seconds, study_date)
       values (gen_random_uuid(), '${A}', 'q', 't', 'bien', true, 1, '2026-11-01')`))).rejects.toThrow(/row-level security/);
  });

  it('upsert_card_states aplica "gana la última escritura"', async () => {
    await como(A, db => db.query('select upsert_card_states($1::jsonb)', [card('2026-11-01T10:00:00Z', 3)]));
    await como(A, db => db.query('select upsert_card_states($1::jsonb)', [card('2026-11-01T09:00:00Z', 99)]));  // más antigua: se ignora
    let filas = await como(A, db => db.query<{ interval_days: number }>('select interval_days from card_states'));
    expect(filas.rows[0].interval_days).toBe(3);
    await como(A, db => db.query('select upsert_card_states($1::jsonb)', [card('2026-11-01T11:00:00Z', 7)]));  // más nueva: gana
    filas = await como(A, db => db.query<{ interval_days: number }>('select interval_days from card_states'));
    expect(filas.rows[0].interval_days).toBe(7);
    // B tiene su propia fila independiente con el mismo question_id.
    await como(B, db => db.query('select upsert_card_states($1::jsonb)', [card('2026-11-01T08:00:00Z', 1)]));
    expect((await como(B, db => db.query('select * from card_states'))).rows).toHaveLength(1);
  });

  it('upsert_profile guarda y respeta la versión más reciente', async () => {
    const perfil = (updatedAt: string, newPerDay: number) => JSON.stringify({
      locale: 'en', new_per_day: newPerDay, simulated_date: '2026-11-01', plan_start: '2026-11-01',
      current_day: 1, completed_lessons: [1], starred: ['rag-fc1'], updated_at: updatedAt
    });
    await como(A, db => db.query('select upsert_profile($1::jsonb)', [perfil('2026-11-01T10:00:00Z', 8)]));
    await como(A, db => db.query('select upsert_profile($1::jsonb)', [perfil('2026-11-01T09:00:00Z', 4)]));
    const filas = await como(A, db => db.query<{ new_per_day: number; locale: string; starred: string[] }>('select new_per_day, locale, starred from profiles'));
    expect(filas.rows[0]).toEqual({ new_per_day: 8, locale: 'en', starred: ['rag-fc1'] });
  });

  it('server_updated_at avanza en cada cambio (cursor de descarga)', async () => {
    const antes = await como(A, db => db.query<{ s: string }>('select server_updated_at as s from card_states'));
    await pg.exec(`select pg_sleep(0.01)`);
    await como(A, db => db.query('select upsert_card_states($1::jsonb)', [card('2026-11-01T12:00:00Z', 9)]));
    const despues = await como(A, db => db.query<{ s: string }>('select server_updated_at as s from card_states'));
    expect(new Date(despues.rows[0].s).getTime()).toBeGreaterThan(new Date(antes.rows[0].s).getTime());
  });
});
