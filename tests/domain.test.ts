import { describe, expect, it } from 'vitest';
import { addDays } from '../src/domain/dates';
import { buildDailyQueue, buildExamQueue, buildHardQueue } from '../src/domain/queue';
import { buildReport, streak } from '../src/domain/report';
import { estimateInterval, rateCard } from '../src/domain/scheduler';
import type { CardState, ReviewLog } from '../src/domain/types';
import { computeCurrentDay } from '../src/state/progress';
import { loadSyllabusFile, profile } from './helpers';

const temario = loadSyllabusFile('es');
const HOY = '2026-11-01';

describe('scheduler (SM-2 simplificado)', () => {
  it('programa 1 día, luego 3 y luego intervalo × facilidad con "Bien"', () => {
    const c1 = rateCard(undefined, 'q', 'bien', HOY);
    expect([c1.interval, c1.dueDate]).toEqual([1, '2026-11-02']);
    const c2 = rateCard(c1, 'q', 'bien', c1.dueDate);
    expect(c2.interval).toBe(3);
    const c3 = rateCard(c2, 'q', 'bien', c2.dueDate);
    expect(c3.interval).toBe(Math.round(3 * 2.5));
  });

  it('"Otra vez" reinicia la racha y baja la facilidad sin pasar del mínimo', () => {
    let card = rateCard(undefined, 'q', 'bien', HOY);
    for (let i = 0; i < 10; i++) card = rateCard(card, 'q', 'otra_vez', HOY);
    expect(card.repetitions).toBe(0);
    expect(card.interval).toBe(1);
    expect(card.ease).toBeCloseTo(1.3);
  });

  it('"Fácil" alarga el intervalo un 30 % respecto de "Bien"', () => {
    const base = rateCard(rateCard(undefined, 'q', 'bien', HOY), 'q', 'bien', HOY);
    expect(estimateInterval(base, 'facil')).toBe(Math.round(estimateInterval(base, 'bien') * 1.3));
  });

  it('no modifica la tarjeta anterior', () => {
    const anterior = rateCard(undefined, 'q', 'bien', HOY);
    const copia = { ...anterior };
    rateCard(anterior, 'q', 'dificil', HOY);
    expect(anterior).toEqual(copia);
  });
});

describe('colas', () => {
  it('el cupo de preguntas nuevas es diario', () => {
    const p = profile({ newPerDay: 5 });
    expect(buildDailyQueue(temario, {}, p, 1)).toHaveLength(5);
    // Ya se introdujeron 5 hoy: no quedan nuevas.
    const vistas: Record<string, CardState> = {};
    temario.dias[0].preguntas.slice(0, 5).forEach(q => { vistas[q.id] = rateCard(undefined, q.id, 'bien', HOY); });
    expect(buildDailyQueue(temario, vistas, p, 1)).toHaveLength(0);
  });

  it('recupera preguntas pendientes de días anteriores después de las del día actual', () => {
    const vistas: Record<string, CardState> = {};
    temario.dias[1].preguntas.forEach(q => { vistas[q.id] = rateCard(undefined, q.id, 'bien', '2026-10-01'); });
    const cola = buildDailyQueue(temario, vistas, profile({ newPerDay: 12, simulatedDate: '2026-10-01' }), 2);
    // Día 2 ya visto completo hoy → cupo agotado; mañana entran las 12 del día 1.
    expect(cola.filter(q => q.clase === 'nueva')).toHaveLength(0);
    const manana = buildDailyQueue(temario, vistas, profile({ simulatedDate: '2026-10-02' }), 2);
    expect(manana.filter(q => q.clase === 'nueva').every(q => q.dia === 1)).toBe(true);
    expect(manana.filter(q => q.clase === 'repaso')).toHaveLength(12);
  });

  it('las opciones mezcladas conservan todas las opciones originales', () => {
    const [pregunta] = buildDailyQueue(temario, {}, profile(), 1).filter(q => q.tipo === 'opcion_multiple');
    expect([...pregunta.opcionesMezcladas!].sort()).toEqual([...pregunta.opciones!].sort());
  });

  it('difíciles = estrellas + calificadas como Difícil u Otra vez', () => {
    const logs: ReviewLog[] = [{ id: '1', questionId: 'mcp-mc1', topicId: 'mcp', rating: 'otra_vez', correct: false, seconds: 3, studyDate: HOY }];
    const ids = buildHardQueue(temario, profile({ starred: ['rag-fc1'] }), logs).map(q => q.id).sort();
    expect(ids).toEqual(['mcp-mc1', 'rag-fc1']);
  });

  it('el simulacro solo usa días desbloqueados y convierte flashcards en opción múltiple', () => {
    const examen = buildExamQueue(temario, 2, 20);
    expect(examen).toHaveLength(20);
    expect(examen.every(q => q.dia <= 2 && q.tipo === 'opcion_multiple' && q.opcionesMezcladas!.includes(q.respuestaCorrecta))).toBe(true);
  });
});

describe('reporte', () => {
  it('ordena por índice de dificultad y deja al final los temas sin datos', () => {
    const logs: ReviewLog[] = [
      { id: '1', questionId: 'mcp-mc1', topicId: 'mcp', rating: 'otra_vez', correct: false, seconds: 10, studyDate: HOY },
      { id: '2', questionId: 'modelos-mc1', topicId: 'modelos', rating: 'facil', correct: true, seconds: 5, studyDate: HOY }
    ];
    const { filas, falladas } = buildReport(logs, temario);
    expect(filas.slice(0, 2).map(f => f.tema.id)).toEqual(['mcp', 'modelos']);
    expect(filas.slice(2).every(f => f.total === 0)).toBe(true);
    expect(falladas).toEqual([{ questionId: 'mcp-mc1', topicId: 'mcp', fallos: 1, ultima: 'otra_vez' }]);
  });

  it('cuenta la racha hacia atrás desde la fecha actual', () => {
    const log = (studyDate: string): ReviewLog => ({ id: studyDate, questionId: 'q', topicId: 't', rating: 'bien', correct: true, seconds: 1, studyDate });
    expect(streak([log('2026-10-30'), log('2026-10-31'), log(HOY)], HOY, addDays)).toBe(3);
    expect(streak([log('2026-10-30')], HOY, addDays)).toBe(0);
  });
});

describe('día del plan', () => {
  it('avanza con la fecha simulada, no retrocede y no supera el total', () => {
    expect(computeCurrentDay(profile({ simulatedDate: '2026-11-04' }), 10)).toBe(4);
    expect(computeCurrentDay(profile({ simulatedDate: HOY, currentDay: 6 }), 10)).toBe(6);
    expect(computeCurrentDay(profile({ simulatedDate: '2027-01-01' }), 10)).toBe(10);
  });
});
