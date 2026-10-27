import { describe, expect, it } from 'vitest';
import { mergeSyllabus } from '../src/data/content';
import { convertLegacy } from '../src/data/legacy';
import { loadSyllabusFile } from './helpers';

const es = loadSyllabusFile('es');
const en = loadSyllabusFile('en');

describe('contenido multidioma', () => {
  it('todos los idiomas tienen exactamente los mismos IDs de pregunta', () => {
    const ids = (s: typeof es) => s.dias.flatMap(d => d.preguntas.map(p => p.id));
    expect(ids(en)).toEqual(ids(es));
  });

  it('lo que falta en una traducción se toma del español y se marca', () => {
    const parcial = { ...en, dias: en.dias.slice(0, 9).map((d, i) => i === 0 ? { ...d, preguntas: d.preguntas.slice(1) } : d) };
    const combinado = mergeSyllabus(es, parcial);
    expect(combinado.dias).toHaveLength(10);
    expect(combinado.dias[9].sinTraducir).toBe(true);
    expect(combinado.dias[9].leccion.titulo).toBe(es.dias[9].leccion.titulo);
    expect(combinado.dias[0].preguntas[0]).toMatchObject({ id: es.dias[0].preguntas[0].id, sinTraducir: true });
    expect(combinado.dias[0].preguntas[1].enunciado).toBe(en.dias[0].preguntas[1].enunciado);
  });
});

describe('migración desde la v1', () => {
  const v1 = {
    version: 1, simulatedDate: '2026-10-26', newPerDay: 6, fechaInicio: '2026-10-24', currentDay: 3,
    schedules: { 'mcp-mc1': { intervalo: 3, facilidad: 2.35, repeticiones: 2, proximaFecha: '2026-10-29', historial: [{ fecha: '2026-10-25', calificacion: 'dificil' }, { fecha: '2026-10-26', calificacion: 'bien' }] } },
    activity: [{ fecha: '2026-10-25', preguntaId: 'mcp-mc1', temaId: 'mcp', calificacion: 'dificil', acierto: true, tiempoSeg: 12 }],
    starred: ['rag-fc1'], completedLessons: [1, 2]
  };

  it('convierte tarjetas, repasos y perfil', () => {
    const r = convertLegacy(v1, 'es')!;
    expect(r.cards[0]).toMatchObject({ questionId: 'mcp-mc1', interval: 3, ease: 2.35, repetitions: 2, dueDate: '2026-10-29', firstSeen: '2026-10-25' });
    expect(r.logs[0]).toMatchObject({ questionId: 'mcp-mc1', topicId: 'mcp', rating: 'dificil', correct: true, seconds: 12, studyDate: '2026-10-25' });
    expect(r.profile).toMatchObject({ newPerDay: 6, planStart: '2026-10-24', currentDay: 3, starred: ['rag-fc1'], completedLessons: [1, 2] });
  });

  it('rechaza datos que no son de la v1', () => {
    expect(convertLegacy({ foo: 1 }, 'es')).toBeNull();
    expect(convertLegacy(null, 'es')).toBeNull();
  });
});
