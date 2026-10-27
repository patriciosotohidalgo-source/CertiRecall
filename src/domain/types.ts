// Tipos compartidos por toda la aplicación.

export type Rating = 'otra_vez' | 'dificil' | 'bien' | 'facil';
export const RATINGS: Rating[] = ['otra_vez', 'dificil', 'bien', 'facil'];
export type Difficulty = 'basica' | 'intermedia' | 'avanzada';

// ---- Contenido (JSON estático por idioma) ----
export interface Topic { id: string; nombre: string; color: string }
export interface Concept { termino: string; definicion: string }
export interface Source { titulo: string; url: string }

export interface Lesson {
  titulo: string;
  resumen: string | string[];
  puntosClave: string[];
  conceptos?: Concept[];
  ejemplo?: { titulo: string; lenguaje: string; codigo: string };
  erroresComunes?: string[];
  fuentes?: Source[];
}

export interface Question {
  id: string;
  temaId: string;
  tipo: 'opcion_multiple' | 'flashcard';
  dificultad?: Difficulty;
  enunciado: string;
  opciones?: string[];
  respuestaCorrecta: string;
  explicacion: string;
  sinTraducir?: boolean;
}

export interface Day { dia: number; tema: Topic; leccion: Lesson; preguntas: Question[]; sinTraducir?: boolean }
export interface Syllabus { certificacion: string; dias: Day[] }

// ---- Progreso del usuario (local y sincronizado) ----

/** Estado de repetición espaciada de una pregunta. */
export interface CardState {
  questionId: string;
  interval: number;
  ease: number;
  repetitions: number;
  dueDate: string;      // AAAA-MM-DD
  firstSeen: string;    // fecha en que se calificó por primera vez
  updatedAt: string;    // ISO; decide qué versión gana al sincronizar
}

/** Un repaso: registro inmutable, solo se agregan nuevos. */
export interface ReviewLog {
  id: string;           // UUID generado en el dispositivo
  questionId: string;
  topicId: string;
  rating: Rating;
  correct: boolean;
  seconds: number;
  studyDate: string;    // AAAA-MM-DD (fecha simulada del plan)
}

export interface Profile {
  locale: string;
  newPerDay: number;
  simulatedDate: string;
  planStart: string;
  currentDay: number;
  completedLessons: number[];
  starred: string[];
  updatedAt: string;
}

/** Pregunta preparada para una sesión (con su día, tema y opciones mezcladas). */
export interface SessionQuestion extends Question {
  dia: number;
  tema: Topic;
  clase: 'nueva' | 'repaso' | 'simulacro';
  opcionesMezcladas?: string[];
}
