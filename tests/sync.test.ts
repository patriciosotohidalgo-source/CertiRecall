import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, db, loadSnapshot, saveProfile, saveReview, setValue } from '../src/data/localDb';
import { claimLocalData, syncOnce, type RemoteAdapter } from '../src/data/sync';
import { rateCard } from '../src/domain/scheduler';
import type { CardState, Profile, ReviewLog } from '../src/domain/types';
import { profile } from './helpers';

/** Servidor en memoria con las mismas reglas que el SQL: repasos idempotentes y "gana la última escritura". */
function memoryServer() {
  let reloj = 0;
  const marca = () => new Date(Date.UTC(2026, 10, 1, 0, 0, ++reloj)).toISOString();
  const cards = new Map<string, CardState & { serverAt: string }>();
  const logs = new Map<string, ReviewLog & { serverAt: string }>();
  let perfil: (Profile & { serverAt: string }) | undefined;

  const adapter: RemoteAdapter = {
    async pushLogs(nuevos) { nuevos.forEach(l => { if (!logs.has(l.id)) logs.set(l.id, { ...l, serverAt: marca() }); }); },
    async pushCards(nuevas) {
      nuevas.forEach(c => {
        const actual = cards.get(c.questionId);
        if (!actual || actual.updatedAt < c.updatedAt) cards.set(c.questionId, { ...c, serverAt: marca() });
      });
    },
    async pushProfile(p) { if (!perfil || perfil.updatedAt < p.updatedAt) perfil = { ...p, serverAt: marca() }; },
    async pull(cursor) {
      const desde = cursor ?? '';
      const quitar = <T extends { serverAt: string }>({ serverAt: _s, ...resto }: T) => resto;
      const filasC = [...cards.values()].filter(c => c.serverAt > desde);
      const filasL = [...logs.values()].filter(l => l.serverAt > desde);
      const todas = [...filasC, ...filasL, ...(perfil ? [perfil] : [])].map(f => f.serverAt).sort();
      return {
        cards: filasC.map(quitar) as CardState[],
        logs: filasL.map(quitar) as ReviewLog[],
        profile: perfil ? quitar(perfil) as Profile : undefined,
        cursor: todas.at(-1) ?? cursor
      };
    }
  };
  return { adapter, cards, logs };
}

const log = (questionId: string, id: string): ReviewLog =>
  ({ id, questionId, topicId: 'mcp', rating: 'bien', correct: true, seconds: 4, studyDate: '2026-11-01' });

// Simula cambiar de dispositivo: guarda el contenido de IndexedDB y lo restaura después.
async function snapshotDevice() {
  return { cards: await db.cards.toArray(), logs: await db.logs.toArray(), kv: await db.kv.toArray() };
}
async function restoreDevice(d: Awaited<ReturnType<typeof snapshotDevice>>) {
  await clearAll();
  await db.cards.bulkPut(d.cards); await db.logs.bulkPut(d.logs); await db.kv.bulkPut(d.kv);
}

describe('sincronización local-first', () => {
  beforeEach(async () => { await clearAll(); });

  it('lo estudiado en un dispositivo aparece en otro con la misma cuenta', async () => {
    const servidor = memoryServer();
    // Dispositivo A: estudia como invitado y luego inicia sesión.
    await saveProfile(profile());
    await saveReview(rateCard(undefined, 'mcp-mc1', 'bien', '2026-11-01'), log('mcp-mc1', 'a1'));
    expect(await claimLocalData('user-1')).toBe('conservados');
    const resultado = await syncOnce(servidor.adapter);
    expect(resultado.enviados).toBe(3);
    expect(servidor.logs.size).toBe(1);

    // Dispositivo B: vacío, misma cuenta.
    await clearAll();
    await claimLocalData('user-1');
    await syncOnce(servidor.adapter);
    const b = await loadSnapshot();
    expect(Object.keys(b.cards)).toEqual(['mcp-mc1']);
    expect(b.logs.map(l => l.id)).toEqual(['a1']);
    expect(b.profile?.newPerDay).toBe(12);
  });

  it('reenviar es idempotente y no duplica repasos', async () => {
    const servidor = memoryServer();
    await saveReview(rateCard(undefined, 'mcp-mc1', 'bien', '2026-11-01'), log('mcp-mc1', 'a1'));
    await syncOnce(servidor.adapter);
    await db.logs.update('a1', { synced: 0 });   // como si la confirmación se hubiera perdido
    await syncOnce(servidor.adapter);
    expect(servidor.logs.size).toBe(1);
    expect((await loadSnapshot()).logs).toHaveLength(1);
  });

  it('en un conflicto gana la versión más reciente de la tarjeta', async () => {
    const servidor = memoryServer();
    const base = rateCard(undefined, 'mcp-mc1', 'bien', '2026-11-01', '2026-11-01T08:00:00.000Z');
    await saveReview(base, log('mcp-mc1', 'a1'));
    await syncOnce(servidor.adapter);
    const dispositivoA = await snapshotDevice();

    // B califica después (más reciente).
    await saveReview(rateCard(base, 'mcp-mc1', 'facil', '2026-11-02', '2026-11-02T09:00:00.000Z'), log('mcp-mc1', 'b1'));
    await syncOnce(servidor.adapter);

    // A, offline, había calificado antes (más antigua) y sincroniza al final.
    await restoreDevice(dispositivoA);
    await saveReview(rateCard(base, 'mcp-mc1', 'otra_vez', '2026-11-02', '2026-11-02T07:00:00.000Z'), log('mcp-mc1', 'a2'));
    await syncOnce(servidor.adapter);

    const a = await loadSnapshot();
    expect(servidor.cards.get('mcp-mc1')!.updatedAt).toBe('2026-11-02T09:00:00.000Z');
    expect(a.cards['mcp-mc1'].updatedAt).toBe('2026-11-02T09:00:00.000Z');
    // Los repasos de ambos dispositivos se conservan.
    expect(a.logs.map(l => l.id).sort()).toEqual(['a1', 'a2', 'b1']);
  });

  it('al iniciar sesión con otra cuenta se borran los datos locales de la anterior', async () => {
    await setValue('ownerId', 'user-1');
    await saveReview(rateCard(undefined, 'mcp-mc1', 'bien', '2026-11-01'), log('mcp-mc1', 'a1'));
    expect(await claimLocalData('user-2')).toBe('reemplazados');
    expect((await loadSnapshot()).logs).toHaveLength(0);
  });
});
