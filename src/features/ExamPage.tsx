import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { topicStyle } from '../components/topic';
import { buildExamQueue } from '../domain/queue';
import { useProgress } from '../state/progress';

const DURACION_MS = 20 * 60 * 1000;

const formatearTiempo = (segundos: number) =>
  `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(Math.max(0, segundos % 60)).padStart(2, '0')}`;

/** Cada intento es un simulacro nuevo (cambia la clave y se arma otra vez). */
export default function ExamPage() {
  const [intento, setIntento] = useState(0);
  return <Exam key={intento} onRestart={() => setIntento(n => n + 1)} />;
}

function Exam({ onRestart }: { onRestart: () => void }) {
  const { t } = useTranslation();
  const { syllabus, currentDay } = useProgress();
  const [preguntas] = useState(() => buildExamQueue(syllabus, currentDay, 20));
  const [indice, setIndice] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [fin] = useState(() => Date.now() + DURACION_MS);
  const [ahora, setAhora] = useState(() => Date.now());
  const [terminado, setTerminado] = useState(false);

  const terminar = useCallback(() => setTerminado(true), []);

  // Temporizador: al llegar a cero el simulacro termina solo.
  useEffect(() => {
    if (terminado) return;
    const id = setInterval(() => {
      const momento = Date.now();
      setAhora(momento);
      if (momento >= fin) terminar();
    }, 500);
    return () => clearInterval(id);
  }, [terminado, fin, terminar]);

  if (preguntas.length === 0) {
    return (
      <section className="empty-state">
        <span className="eyebrow">{t('exam.eyebrow')}</span><h2>{t('exam.noQuestions')}</h2><p>{t('exam.noQuestionsText')}</p>
      </section>
    );
  }

  if (terminado) {
    const aciertos = preguntas.filter(p => respuestas[p.id] === p.respuestaCorrecta).length;
    const porTema = new Map<string, { nombre: string; aciertos: number; total: number }>();
    preguntas.forEach(p => {
      const grupo = porTema.get(p.tema.id) ?? { nombre: p.tema.nombre, aciertos: 0, total: 0 };
      grupo.total += 1;
      if (respuestas[p.id] === p.respuestaCorrecta) grupo.aciertos += 1;
      porTema.set(p.tema.id, grupo);
    });
    return (
      <>
        <section className="summary-card">
          <span className="eyebrow">{t('exam.result')}</span>
          <h2>{t('exam.score', { correct: aciertos, total: preguntas.length })}</h2>
          <p>{t('exam.noEffect')}</p>
          <div className="exam-results">
            {[...porTema.values()].map(grupo => <div key={grupo.nombre}><span>{grupo.nombre}</span><b>{grupo.aciertos}/{grupo.total}</b></div>)}
          </div>
          <div className="home-actions">
            <button className="button button-secondary" data-action="exam-restart" onClick={onRestart}>{t('exam.newExam')}</button>
            <Link className="button button-dark" to="/">{t('common.backHome')}</Link>
          </div>
        </section>
        <section className="exam-review">
          <div className="section-heading"><div><span className="eyebrow">{t('exam.finalReview')}</span><h3>{t('exam.answers')}</h3></div></div>
          {preguntas.map((p, i) => {
            const acierto = respuestas[p.id] === p.respuestaCorrecta;
            return (
              <article key={p.id} className={`panel exam-review-item ${acierto ? 'exam-review-correct' : 'exam-review-incorrect'}`}>
                <span className="eyebrow">{t('exam.questionN', { n: i + 1 })} · {p.tema.nombre}</span>
                <h4>{p.enunciado}</h4>
                <p>{t('exam.yourAnswer')} <b>{respuestas[p.id] ?? t('exam.noAnswer')}</b></p>
                {!acierto && <p>{t('exam.rightAnswer')} <b>{p.respuestaCorrecta}</b></p>}
                <small>{p.explicacion}</small>
              </article>
            );
          })}
        </section>
      </>
    );
  }

  const pregunta = preguntas[indice];
  const ultima = indice + 1 === preguntas.length;
  return (
    <>
      <section className="exam-top">
        <div>
          <span className="eyebrow">{t('exam.progress', { current: indice + 1, total: preguntas.length })}</span>
          <div className="quiz-progress"><i style={{ width: `${Math.round(indice / preguntas.length * 100)}%` }}></i></div>
        </div>
        <div className="exam-timer" aria-live="polite">⏱ {formatearTiempo(Math.max(0, Math.ceil((fin - ahora) / 1000)))}</div>
      </section>
      <article className="quiz-card" style={topicStyle(pregunta.tema.color)}>
        <div className="card-meta">
          <span className="topic-pill">{pregunta.tema.nombre}</span>
          <span>{t(`difficulty.${pregunta.dificultad ?? 'intermedia'}`)}</span>
        </div>
        <h2>{pregunta.enunciado}</h2>
        <div className="answer-options">
          {pregunta.opcionesMezcladas!.map(opcion => (
            <button key={opcion} className={`option-button ${respuestas[pregunta.id] === opcion ? 'option-selected' : ''}`}
              onClick={() => setRespuestas(actual => ({ ...actual, [pregunta.id]: opcion }))}>{opcion}</button>
          ))}
        </div>
        <div className="exam-controls">
          <button className="button button-secondary" disabled={indice === 0} onClick={() => setIndice(i => i - 1)}>{t('exam.previous')}</button>
          <span>{t('exam.answered', { count: Object.keys(respuestas).length, total: preguntas.length })}</span>
          {ultima
            ? <button className="button button-dark" data-action="exam-finish" onClick={terminar}>{t('exam.finish')}</button>
            : <button className="button button-dark" data-action="exam-next" onClick={() => setIndice(i => i + 1)}>{t('exam.next')}</button>}
        </div>
      </article>
      <p className="keyboard-hint">{t('exam.hint')}</p>
    </>
  );
}
