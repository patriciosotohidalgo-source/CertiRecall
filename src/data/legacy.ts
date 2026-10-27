// Migración desde la v1, que guardaba todo en localStorage.
import { addDays } from '../domain/dates';
import type { CardState, Profile, Rating, ReviewLog } from '../domain/types';

export const LEGACY_KEY = 'certirecall-progreso-v1';

interface LegacySchedule {
  intervalo: number; facilidad: number; repeticiones: number; proximaFecha: string;
  historial: { fecha: string; calificacion: Rating }[];
}
interface LegacyProgress {
  version: 1; simulatedDate: string; newPerDay: number; fechaInicio?: string; currentDay?: number;
  schedules: Record<string, LegacySchedule>;
  activity: { fecha: string; preguntaId: string; temaId: string; calificacion: Rating; acierto: boolean; tiempoSeg: number }[];
  starred: string[]; completedLessons: number[];
}

const esFecha = (valor: unknown) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);

function isLegacyProgress(datos: unknown): datos is LegacyProgress {
  const d = datos as LegacyProgress;
  return Boolean(d && d.version === 1 && esFecha(d.simulatedDate)
    && d.schedules && typeof d.schedules === 'object'
    && Array.isArray(d.activity) && Array.isArray(d.starred) && Array.isArray(d.completedLessons));
}

/** Convierte el progreso de la v1 al modelo de la v2. Devuelve null si no es válido. */
export function convertLegacy(datos: unknown, locale: string, ahora = new Date().toISOString()) {
  if (!isLegacyProgress(datos)) return null;
  const cards: CardState[] = Object.entries(datos.schedules).map(([questionId, s]) => ({
    questionId,
    interval: s.intervalo,
    ease: s.facilidad,
    repetitions: s.repeticiones,
    dueDate: s.proximaFecha,
    firstSeen: s.historial[0]?.fecha ?? addDays(s.proximaFecha, -s.intervalo),
    updatedAt: ahora
  }));
  const logs: ReviewLog[] = datos.activity.map(a => ({
    id: crypto.randomUUID(),
    questionId: a.preguntaId,
    topicId: a.temaId,
    rating: a.calificacion,
    correct: a.acierto,
    seconds: a.tiempoSeg,
    studyDate: a.fecha
  }));
  const profile: Profile = {
    locale,
    newPerDay: datos.newPerDay,
    simulatedDate: datos.simulatedDate,
    planStart: datos.fechaInicio ?? datos.simulatedDate,
    currentDay: datos.currentDay ?? 1,
    completedLessons: datos.completedLessons,
    starred: datos.starred,
    updatedAt: ahora
  };
  return { cards, logs, profile };
}

export function readLegacy(): unknown {
  try {
    const texto = localStorage.getItem(LEGACY_KEY);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}
