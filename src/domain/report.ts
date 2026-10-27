// Estadísticas del reporte a partir de los repasos registrados.
import type { Rating, ReviewLog, Syllabus, Topic } from './types';

const porcentaje = (cantidad: number, total: number) => total ? Math.round(cantidad / total * 100) : 0;

export interface TopicRow {
  tema: Topic;
  total: number;
  acierto: number;
  dificil: number;
  score: number;      // índice de dificultad: promedio de % difícil y % de error
  tiempo: number;
  conteos: Record<Rating, number>;
}

export interface Report {
  filas: TopicRow[];
  dias: { fecha: string; acierto: number }[];
  falladas: { questionId: string; topicId: string; fallos: number; ultima: Rating }[];
}

export function buildReport(logs: ReviewLog[], syllabus: Syllabus): Report {
  const filas = syllabus.dias.map(({ tema }) => {
    const eventos = logs.filter(log => log.topicId === tema.id);
    const total = eventos.length;
    const acierto = porcentaje(eventos.filter(log => log.correct).length, total);
    const dificil = porcentaje(eventos.filter(log => log.rating === 'dificil' || log.rating === 'otra_vez').length, total);
    const conteos = { otra_vez: 0, dificil: 0, bien: 0, facil: 0 } as Record<Rating, number>;
    eventos.forEach(log => { conteos[log.rating] += 1; });
    return {
      tema, total, acierto, dificil,
      score: Math.round((dificil + 100 - acierto) / 2),
      tiempo: total ? Math.round(eventos.reduce((suma, log) => suma + log.seconds, 0) / total) : 0,
      conteos
    };
  })
    // Los temas sin repasos van al final: sin datos no se puede medir su dificultad.
    .sort((a, b) => Number(b.total > 0) - Number(a.total > 0) || b.score - a.score);

  const porFecha = new Map<string, ReviewLog[]>();
  logs.forEach(log => porFecha.set(log.studyDate, [...(porFecha.get(log.studyDate) ?? []), log]));
  const dias = [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, eventos]) => ({ fecha, acierto: porcentaje(eventos.filter(log => log.correct).length, eventos.length) }));

  const fallos = new Map<string, Report['falladas'][number]>();
  logs.filter(log => !log.correct).forEach(log => {
    const item = fallos.get(log.questionId) ?? { questionId: log.questionId, topicId: log.topicId, fallos: 0, ultima: log.rating };
    item.fallos += 1;
    item.ultima = log.rating;
    fallos.set(log.questionId, item);
  });

  return { filas, dias, falladas: [...fallos.values()].sort((a, b) => b.fallos - a.fallos).slice(0, 8) };
}

/** Racha de días seguidos con actividad, contando hacia atrás desde la fecha actual. */
export function streak(logs: ReviewLog[], fechaActual: string, addDays: (f: string, d: number) => string): number {
  const fechas = new Set(logs.map(log => log.studyDate));
  let racha = 0;
  let cursor = fechaActual;
  while (fechas.has(cursor)) {
    racha += 1;
    cursor = addDays(cursor, -1);
  }
  return racha;
}
