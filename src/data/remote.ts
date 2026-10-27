// Adaptador de Supabase. Solo se activa si existen las variables de entorno;
// sin ellas la app funciona en modo invitado (solo datos locales).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CardState, Profile, ReviewLog } from '../domain/types';
import type { PullResult, RemoteAdapter } from './sync';

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE_ANONIMA = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = URL_SUPABASE && CLAVE_ANONIMA
  ? createClient(URL_SUPABASE, CLAVE_ANONIMA, {
    // PKCE devuelve ?code= en la URL; no choca con las rutas #/ del HashRouter.
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }
  })
  : null;

export const syncAvailable = supabase !== null;

// Margen para no perder filas confirmadas con un leve retraso en el servidor.
const MARGEN_MS = 60_000;

function check<T>(respuesta: { data: T; error: { message: string } | null }): T {
  if (respuesta.error) throw new Error(respuesta.error.message);
  return respuesta.data;
}

// Postgres devuelve "…+00:00" y el cliente "…Z": se normaliza antes de comparar.
const maxFecha = (fechas: (string | null | undefined)[]) =>
  fechas
    .filter((fecha): fecha is string => Boolean(fecha))
    .map(fecha => new Date(fecha).toISOString())
    .sort()
    .at(-1) ?? null;

export function createSupabaseAdapter(cliente: SupabaseClient): RemoteAdapter {
  return {
    async pushLogs(logs: ReviewLog[]) {
      // Repasos idempotentes: si el id ya existe, se ignora.
      check(await cliente.from('review_logs').upsert(logs.map(log => ({
        id: log.id, question_id: log.questionId, topic_id: log.topicId, rating: log.rating,
        correct: log.correct, seconds: log.seconds, study_date: log.studyDate
      })), { onConflict: 'id', ignoreDuplicates: true }));
    },

    async pushCards(cards: CardState[]) {
      // La función del servidor solo sobrescribe si la versión enviada es más nueva.
      check(await cliente.rpc('upsert_card_states', { cards: cards.map(card => ({
        question_id: card.questionId, interval_days: card.interval, ease: card.ease,
        repetitions: card.repetitions, due_date: card.dueDate, first_seen: card.firstSeen,
        updated_at: card.updatedAt
      })) }));
    },

    async pushProfile(profile: Profile) {
      check(await cliente.rpc('upsert_profile', { profile: {
        locale: profile.locale, new_per_day: profile.newPerDay, simulated_date: profile.simulatedDate,
        plan_start: profile.planStart, current_day: profile.currentDay,
        completed_lessons: profile.completedLessons, starred: profile.starred, updated_at: profile.updatedAt
      } }));
    },

    async pull(cursor: string | null): Promise<PullResult> {
      const desde = cursor ? new Date(new Date(cursor).getTime() - MARGEN_MS).toISOString() : '1970-01-01T00:00:00Z';
      const [cards, logs, perfiles] = await Promise.all([
        cliente.from('card_states').select('*').gt('server_updated_at', desde),
        cliente.from('review_logs').select('*').gt('synced_at', desde),
        cliente.from('profiles').select('*').limit(1)
      ]);
      const filasCards = check(cards) ?? [];
      const filasLogs = check(logs) ?? [];
      const perfil = (check(perfiles) ?? [])[0];
      return {
        cards: filasCards.map(fila => ({
          questionId: fila.question_id, interval: fila.interval_days, ease: fila.ease,
          repetitions: fila.repetitions, dueDate: fila.due_date, firstSeen: fila.first_seen,
          updatedAt: new Date(fila.updated_at).toISOString()
        })),
        logs: filasLogs.map(fila => ({
          id: fila.id, questionId: fila.question_id, topicId: fila.topic_id, rating: fila.rating,
          correct: fila.correct, seconds: fila.seconds, studyDate: fila.study_date
        })),
        profile: perfil ? {
          locale: perfil.locale, newPerDay: perfil.new_per_day, simulatedDate: perfil.simulated_date,
          planStart: perfil.plan_start, currentDay: perfil.current_day,
          completedLessons: perfil.completed_lessons ?? [], starred: perfil.starred ?? [],
          updatedAt: new Date(perfil.updated_at).toISOString()
        } : undefined,
        cursor: maxFecha([
          cursor,
          ...filasCards.map(fila => fila.server_updated_at),
          ...filasLogs.map(fila => fila.synced_at),
          perfil?.server_updated_at
        ])
      };
    }
  };
}
