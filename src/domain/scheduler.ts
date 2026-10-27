// Repetición espaciada: versión simplificada del algoritmo SM-2 (base de Anki).
// Cada pregunta guarda: intervalo (días), facilidad (factor de crecimiento),
// repeticiones seguidas sin fallar y la próxima fecha de repaso.
import { addDays } from './dates';
import type { CardState, Rating } from './types';

const FACILIDAD_INICIAL = 2.5;
const FACILIDAD_MINIMA = 1.3;

// Días hasta el próximo repaso según la calificación (se muestra en cada botón).
export function estimateInterval(card: CardState | undefined, rating: Rating): number {
  const repeticiones = card?.repetitions ?? 0;
  const intervalo = card?.interval ?? 0;
  const facilidad = card?.ease ?? FACILIDAD_INICIAL;

  // Otra vez: se olvidó; vuelve mañana (y además se repite en la sesión actual).
  if (rating === 'otra_vez') return 1;

  // Difícil: el intervalo crece poco (×1,2).
  if (rating === 'dificil') return Math.max(1, Math.round((intervalo || 1) * 1.2));

  // Bien: 1 día la primera vez, 3 días la segunda y luego intervalo × facilidad.
  let dias: number;
  if (repeticiones === 0) dias = 1;
  else if (repeticiones === 1) dias = 3;
  else dias = Math.max(1, Math.round((intervalo || 1) * facilidad));

  // Fácil: como Bien, pero un 30 % más largo.
  if (rating === 'facil') dias = Math.max(1, Math.round(dias * 1.3));
  return dias;
}

// Devuelve el nuevo estado de la tarjeta; no modifica el anterior.
export function rateCard(
  previous: CardState | undefined,
  questionId: string,
  rating: Rating,
  fecha: string,
  ahora = new Date().toISOString()
): CardState {
  const dias = estimateInterval(previous, rating);
  const card: CardState = previous
    ? { ...previous }
    : { questionId, interval: 0, ease: FACILIDAD_INICIAL, repetitions: 0, dueDate: fecha, firstSeen: fecha, updatedAt: ahora };

  if (rating === 'otra_vez') {
    // Un fallo reinicia la racha y hace la pregunta más "difícil".
    card.interval = 1;
    card.repetitions = 0;
    card.ease = Math.max(FACILIDAD_MINIMA, card.ease - 0.2);
  } else if (rating === 'dificil') {
    card.interval = dias;
    card.repetitions += 1;
    card.ease = Math.max(FACILIDAD_MINIMA, card.ease - 0.15);
  } else {
    card.interval = dias;
    card.repetitions += 1;
    if (rating === 'facil') card.ease += 0.15;
  }

  card.dueDate = addDays(fecha, dias);
  card.updatedAt = ahora;
  return card;
}

export function isDue(card: CardState | undefined, fecha: string): boolean {
  return Boolean(card && card.dueDate <= fecha);
}
