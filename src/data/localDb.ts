// Almacenamiento local en IndexedDB (Dexie): la app funciona sin conexión
// y guarda qué cambios faltan por enviar al servidor.
import Dexie, { type Table } from 'dexie';
import type { CardState, Profile, ReviewLog } from '../domain/types';

interface CardRow extends CardState { dirty: 0 | 1 }
interface LogRow extends ReviewLog { synced: 0 | 1 }
interface KeyValue { key: string; value: unknown }

class CertiRecallDb extends Dexie {
  cards!: Table<CardRow, string>;
  logs!: Table<LogRow, string>;
  kv!: Table<KeyValue, string>;

  constructor() {
    super('certirecall');
    this.version(1).stores({
      cards: 'questionId, dirty',
      logs: 'id, synced, studyDate',
      kv: 'key'
    });
  }
}

export const db = new CertiRecallDb();

export interface LocalSnapshot {
  profile: Profile | undefined;
  cards: Record<string, CardState>;
  logs: ReviewLog[];
}

const sinMarca = <T extends object>(fila: T, marca: keyof T) => {
  const copia = { ...fila };
  delete copia[marca];
  return copia;
};

export async function getValue<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export async function setValue(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

export async function loadSnapshot(): Promise<LocalSnapshot> {
  const [profile, cards, logs] = await Promise.all([
    getValue<Profile>('profile'),
    db.cards.toArray(),
    db.logs.orderBy('studyDate').toArray()
  ]);
  return {
    profile,
    cards: Object.fromEntries(cards.map(card => [card.questionId, sinMarca(card, 'dirty') as CardState])),
    logs: logs.map(log => sinMarca(log, 'synced') as ReviewLog)
  };
}

/** Guarda una calificación: tarjeta actualizada + repaso, ambos pendientes de sincronizar. */
export async function saveReview(card: CardState, log: ReviewLog): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.cards.put({ ...card, dirty: 1 });
    await db.logs.put({ ...log, synced: 0 });
  });
}

export async function saveProfile(profile: Profile): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await setValue('profile', profile);
    await setValue('profileDirty', true);
  });
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, db.kv, async () => {
    await Promise.all([db.cards.clear(), db.logs.clear(), db.kv.clear()]);
  });
}

// ---- Usado por la sincronización ----

export async function pendingChanges() {
  const [cards, logs, profileDirty, profile] = await Promise.all([
    db.cards.where('dirty').equals(1).toArray(),
    db.logs.where('synced').equals(0).toArray(),
    getValue<boolean>('profileDirty'),
    getValue<Profile>('profile')
  ]);
  return {
    cards: cards.map(card => sinMarca(card, 'dirty') as CardState),
    logs: logs.map(log => sinMarca(log, 'synced') as ReviewLog),
    profile: profileDirty ? profile : undefined
  };
}

/** Marca como enviados solo los registros que no cambiaron mientras se sincronizaba. */
export async function markPushed(cards: CardState[], logIds: string[], profile?: Profile): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, db.kv, async () => {
    for (const card of cards) {
      const actual = await db.cards.get(card.questionId);
      if (actual && actual.updatedAt === card.updatedAt) await db.cards.update(card.questionId, { dirty: 0 });
    }
    await db.logs.where('id').anyOf(logIds).modify({ synced: 1 });
    const perfilActual = await getValue<Profile>('profile');
    if (profile && perfilActual?.updatedAt === profile.updatedAt) await setValue('profileDirty', false);
  });
}

/** Aplica lo recibido del servidor, ya resuelto por "gana la última escritura". */
export async function applyRemote(cards: CardState[], logs: ReviewLog[], profile?: Profile): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, db.kv, async () => {
    if (cards.length) await db.cards.bulkPut(cards.map(card => ({ ...card, dirty: 0 as const })));
    if (logs.length) await db.logs.bulkPut(logs.map(log => ({ ...log, synced: 1 as const })));
    if (profile) {
      await setValue('profile', profile);
      await setValue('profileDirty', false);
    }
  });
}

/** Importa datos (migración de la v1 o archivo de respaldo) marcados como pendientes de subir. */
export async function importLocal(cards: CardState[], logs: ReviewLog[], profile: Profile): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, db.kv, async () => {
    await db.cards.bulkPut(cards.map(card => ({ ...card, dirty: 1 as const })));
    await db.logs.bulkPut(logs.map(log => ({ ...log, synced: 0 as const })));
    await setValue('profile', profile);
    await setValue('profileDirty', true);
  });
}
