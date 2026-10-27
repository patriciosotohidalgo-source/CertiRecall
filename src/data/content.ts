// Carga del temario por idioma. Lo que falte en un idioma se toma del español (idioma base).
import type { Day, ReviewLog, Syllabus } from '../domain/types';

export const BASE_LOCALE = 'es';
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const url = (ruta: string) => `${import.meta.env.BASE_URL}${ruta}`;

async function fetchJson<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(url(ruta));
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${ruta} (${respuesta.status}).`);
  return respuesta.json() as Promise<T>;
}

/** Combina una traducción con el temario base, pregunta por pregunta (mismos IDs). */
export function mergeSyllabus(base: Syllabus, traduccion: Syllabus | null): Syllabus {
  if (!traduccion) return base;
  const diasTraducidos = new Map(traduccion.dias.map(dia => [dia.dia, dia]));
  return {
    certificacion: traduccion.certificacion || base.certificacion,
    dias: base.dias.map((dia): Day => {
      const traducido = diasTraducidos.get(dia.dia);
      if (!traducido) return { ...dia, sinTraducir: true };
      const preguntas = new Map(traducido.preguntas.map(pregunta => [pregunta.id, pregunta]));
      return {
        dia: dia.dia,
        tema: { ...dia.tema, nombre: traducido.tema.nombre },
        leccion: traducido.leccion,
        preguntas: dia.preguntas.map(pregunta => preguntas.get(pregunta.id) ?? { ...pregunta, sinTraducir: true })
      };
    })
  };
}

export async function loadSyllabus(locale: string): Promise<Syllabus> {
  const base = await fetchJson<Syllabus>(`content/${BASE_LOCALE}/temario.json`);
  if (locale === BASE_LOCALE || !LOCALES.includes(locale as Locale)) return base;
  const traduccion = await fetchJson<Syllabus>(`content/${locale}/temario.json`).catch(() => null);
  return mergeSyllabus(base, traduccion);
}

// El historial de demostración conserva el formato de la v1.
interface LegacyLog {
  fecha: string; preguntaId: string; temaId: string;
  calificacion: ReviewLog['rating']; acierto: boolean; tiempoSeg: number;
}

export async function loadDemoLogs(): Promise<ReviewLog[]> {
  const registros = await fetchJson<LegacyLog[]>('content/historial-demo.json');
  return registros.map((registro, indice) => ({
    id: `demo-${indice}`,
    questionId: registro.preguntaId,
    topicId: registro.temaId,
    rating: registro.calificacion,
    correct: registro.acierto,
    seconds: registro.tiempoSeg,
    studyDate: registro.fecha
  }));
}
