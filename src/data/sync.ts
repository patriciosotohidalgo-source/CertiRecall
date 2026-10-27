// Sincronización local-first:
// 1) se envían los cambios pendientes; 2) se descargan los cambios de otros dispositivos.
// Repasos: solo se agregan (nunca hay conflicto). Tarjetas y perfil: gana la última escritura (updatedAt).
import type { CardState, Profile, ReviewLog } from '../domain/types';
import { applyRemote, clearAll, getValue, loadSnapshot, markPushed, pendingChanges, setValue } from './localDb';

export interface PullResult {
  cards: CardState[];
  logs: ReviewLog[];
  profile?: Profile;
  cursor: string | null;   // marca de tiempo del servidor hasta donde se descargó
}

/** Lo que la sincronización necesita del servidor (Supabase en producción, memoria en las pruebas). */
export interface RemoteAdapter {
  pushLogs(logs: ReviewLog[]): Promise<void>;
  pushCards(cards: CardState[]): Promise<void>;
  pushProfile(profile: Profile): Promise<void>;
  pull(cursor: string | null): Promise<PullResult>;
}

const masNuevo = (a: { updatedAt: string }, b?: { updatedAt: string }) => !b || a.updatedAt >= b.updatedAt;

/** Tarjetas remotas que deben reemplazar a las locales. */
export function resolveCards(locales: Record<string, CardState>, remotas: CardState[]): CardState[] {
  return remotas.filter(remota => masNuevo(remota, locales[remota.questionId]));
}

export function resolveProfile(local: Profile | undefined, remoto: Profile | undefined): Profile | undefined {
  return remoto && masNuevo(remoto, local) ? remoto : undefined;
}

export async function syncOnce(remote: RemoteAdapter): Promise<{ enviados: number; recibidos: number }> {
  const pendientes = await pendingChanges();
  if (pendientes.logs.length) await remote.pushLogs(pendientes.logs);
  if (pendientes.cards.length) await remote.pushCards(pendientes.cards);
  if (pendientes.profile) await remote.pushProfile(pendientes.profile);
  await markPushed(pendientes.cards, pendientes.logs.map(log => log.id), pendientes.profile);

  const cursor = (await getValue<string>('pullCursor')) ?? null;
  const recibido = await remote.pull(cursor);
  const local = await loadSnapshot();
  const idsLocales = new Set(local.logs.map(log => log.id));
  const logsNuevos = recibido.logs.filter(log => !idsLocales.has(log.id));
  const cards = resolveCards(local.cards, recibido.cards);
  await applyRemote(cards, logsNuevos, resolveProfile(local.profile, recibido.profile));
  if (recibido.cursor) await setValue('pullCursor', recibido.cursor);

  return {
    enviados: pendientes.logs.length + pendientes.cards.length + (pendientes.profile ? 1 : 0),
    recibidos: logsNuevos.length + cards.length
  };
}

/**
 * Al iniciar sesión: si los datos locales son de otra cuenta, se borran;
 * si son de invitado, se conservan y se suben a la cuenta en la próxima sincronización.
 */
export async function claimLocalData(userId: string): Promise<'conservados' | 'reemplazados'> {
  const dueño = await getValue<string>('ownerId');
  let resultado: 'conservados' | 'reemplazados' = 'conservados';
  if (dueño && dueño !== userId) {
    await clearAll();
    resultado = 'reemplazados';
  }
  await setValue('ownerId', userId);
  return resultado;
}
