// Armado de las colas de preguntas: sesión diaria, repaso de difíciles y simulacro.
import { isDue } from './scheduler';
import type { CardState, Day, Profile, Question, ReviewLog, SessionQuestion, Syllabus } from './types';

export function shuffle<T>(lista: T[]): T[] {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// Fija el orden de las opciones una sola vez por sesión.
export function prepareQuestion(pregunta: Question, dia: Day, clase: SessionQuestion['clase']): SessionQuestion {
  const preparada: SessionQuestion = { ...pregunta, dia: dia.dia, tema: dia.tema, clase };
  if (pregunta.tipo === 'opcion_multiple' && pregunta.opciones) {
    preparada.opcionesMezcladas = shuffle([...pregunta.opciones]);
  }
  return preparada;
}

function findQuestion(syllabus: Syllabus, id: string): { pregunta: Question; dia: Day } | undefined {
  for (const dia of syllabus.dias) {
    const pregunta = dia.preguntas.find(item => item.id === id);
    if (pregunta) return { pregunta, dia };
  }
  return undefined;
}

/** Sesión diaria: preguntas nuevas (con cupo diario) + repasos vencidos. */
export function buildDailyQueue(
  syllabus: Syllabus,
  cards: Record<string, CardState>,
  profile: Profile,
  diaActual: number
): SessionQuestion[] {
  const fecha = profile.simulatedDate;

  // El cupo es diario: descuenta las preguntas que ya se vieron por primera vez hoy.
  const introducidasHoy = Object.values(cards).filter(card => card.firstSeen === fecha).length;
  const cupo = Math.max(0, profile.newPerDay - introducidasHoy);

  // Primero las del día actual y luego las pendientes de días anteriores.
  const diasDisponibles = syllabus.dias
    .filter(dia => dia.dia <= diaActual)
    .sort((a, b) => Number(b.dia === diaActual) - Number(a.dia === diaActual) || a.dia - b.dia);
  const nuevas = diasDisponibles
    .flatMap(dia => dia.preguntas
      .filter(pregunta => !cards[pregunta.id])
      .map(pregunta => prepareQuestion(pregunta, dia, 'nueva')))
    .slice(0, cupo);

  const repasos = Object.values(cards)
    .filter(card => isDue(card, fecha))
    .map(card => findQuestion(syllabus, card.questionId))
    .filter((item): item is { pregunta: Question; dia: Day } => Boolean(item))
    .map(({ pregunta, dia }) => prepareQuestion(pregunta, dia, 'repaso'));

  return shuffle([...nuevas, ...repasos]);
}

/** IDs marcados con estrella o calificados alguna vez como Difícil / Otra vez. */
export function hardQuestionIds(profile: Profile, logs: ReviewLog[]): Set<string> {
  const ids = new Set(profile.starred);
  logs.forEach(log => {
    if (log.rating === 'dificil' || log.rating === 'otra_vez') ids.add(log.questionId);
  });
  return ids;
}

export function buildHardQueue(syllabus: Syllabus, profile: Profile, logs: ReviewLog[]): SessionQuestion[] {
  const ids = hardQuestionIds(profile, logs);
  return shuffle(syllabus.dias.flatMap(dia => dia.preguntas
    .filter(pregunta => ids.has(pregunta.id))
    .map(pregunta => prepareQuestion(pregunta, dia, 'repaso'))));
}

export function buildSingleQuestionQueue(syllabus: Syllabus, id: string): SessionQuestion[] {
  const encontrada = findQuestion(syllabus, id);
  return encontrada ? [prepareQuestion(encontrada.pregunta, encontrada.dia, 'repaso')] : [];
}

/** Simulacro: preguntas al azar de los días desbloqueados; las flashcards se convierten en opción múltiple. */
export function buildExamQueue(syllabus: Syllabus, diaDesbloqueado: number, cantidad = 20): SessionQuestion[] {
  const disponibles = syllabus.dias
    .filter(dia => dia.dia <= diaDesbloqueado)
    .flatMap(dia => dia.preguntas.map(pregunta => {
      if (pregunta.tipo === 'opcion_multiple') return prepareQuestion(pregunta, dia, 'simulacro');
      // Distractores: respuestas de las otras flashcards del mismo tema.
      const opciones = [...new Set([
        pregunta.respuestaCorrecta,
        ...dia.preguntas
          .filter(item => item.tipo === 'flashcard' && item.id !== pregunta.id)
          .map(item => item.respuestaCorrecta)
      ])];
      return prepareQuestion({ ...pregunta, tipo: 'opcion_multiple', opciones }, dia, 'simulacro');
    }));
  return shuffle(disponibles).slice(0, Math.min(cantidad, disponibles.length));
}
