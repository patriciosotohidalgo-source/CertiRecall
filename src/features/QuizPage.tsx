import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { topicStyle } from '../components/topic';
import { formatDate } from '../domain/dates';
import { buildDailyQueue, buildHardQueue, buildSingleQuestionQueue } from '../domain/queue';
import { estimateInterval } from '../domain/scheduler';
import { RATINGS, type Rating, type SessionQuestion } from '../domain/types';
import { useProgress } from '../state/progress';

// Respuesta a la pregunta en pantalla (se reinicia al pasar a la siguiente).
interface Answer { seleccionada?: string; correcta?: boolean; revelada: boolean }

interface Session {
  cola: SessionQuestion[];
  indice: number;
  ratings: Record<Rating, number>;
  aciertos: number;
  respondidas: number;
  temas: Set<string>;
  reencoladas: Set<string>;
  proxima: string;
}

/** La sesión se crea de nuevo si cambia el modo (?modo=, ?pregunta=) o la fecha simulada. */
export default function QuizPage() {
  const [params] = useSearchParams();
  const { profile } = useProgress();
  return <QuizSession key={`${params.toString()}|${profile.simulatedDate}`} />;
}

function QuizSession() {
  const { t, i18n } = useTranslation();
  const { syllabus, cards, logs, profile, currentDay, rate, toggleStar, advanceDay } = useProgress();
  const [params] = useSearchParams();

  const [sesion, setSesion] = useState<Session>(() => {
    const pregunta = params.get('pregunta');
    const cola = pregunta
      ? buildSingleQuestionQueue(syllabus, pregunta)
      : params.get('modo') === 'dificiles'
        ? buildHardQueue(syllabus, profile, logs)
        : buildDailyQueue(syllabus, cards, profile, currentDay);
    return {
      cola, indice: 0, ratings: { otra_vez: 0, dificil: 0, bien: 0, facil: 0 },
      aciertos: 0, respondidas: 0, temas: new Set(), reencoladas: new Set(), proxima: ''
    };
  });
  const [respuesta, setRespuesta] = useState<Answer>({ revelada: false });
  const [inicio, setInicio] = useState(() => Date.now());

  const pregunta = sesion.cola[sesion.indice];
  const esMultiple = pregunta?.tipo === 'opcion_multiple';
  const puedeCalificar = esMultiple ? respuesta.seleccionada !== undefined : respuesta.revelada;

  const responder = (opcion: string) => {
    if (respuesta.seleccionada !== undefined) return;
    setRespuesta({ seleccionada: opcion, correcta: opcion === pregunta.respuestaCorrecta, revelada: true });
  };

  const calificar = useCallback((rating: Rating) => {
    const correcta = esMultiple ? Boolean(respuesta.correcta) : rating !== 'otra_vez';
    const segundos = Math.max(1, Math.round((Date.now() - inicio) / 1000));
    const card = rate(pregunta, rating, correcta, segundos);

    setSesion(actual => {
      const cola = [...actual.cola];
      const reencoladas = new Set(actual.reencoladas);
      // "Otra vez": la pregunta se repite una vez al final de la sesión.
      if (rating === 'otra_vez' && !reencoladas.has(pregunta.id)) {
        reencoladas.add(pregunta.id);
        cola.push({ ...pregunta, clase: 'repaso' });
      }
      return {
        ...actual, cola, reencoladas,
        indice: actual.indice + 1,
        ratings: { ...actual.ratings, [rating]: actual.ratings[rating] + 1 },
        aciertos: actual.aciertos + (correcta ? 1 : 0),
        respondidas: actual.respondidas + 1,
        temas: new Set(actual.temas).add(pregunta.tema.id),
        proxima: !actual.proxima || card.dueDate < actual.proxima ? card.dueDate : actual.proxima
      };
    });
    setRespuesta({ revelada: false });
    setInicio(Date.now());
  }, [esMultiple, respuesta.correcta, inicio, rate, pregunta]);

  // Atajos: 1–4 califican, Espacio muestra la respuesta de una flashcard.
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (!pregunta) return;
      const numero = Number(evento.key);
      if (puedeCalificar && numero >= 1 && numero <= 4) calificar(RATINGS[numero - 1]);
      if (evento.code === 'Space' && !esMultiple && !respuesta.revelada) {
        evento.preventDefault();
        setRespuesta({ revelada: true });
      }
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [pregunta, puedeCalificar, calificar, esMultiple, respuesta.revelada]);

  if (sesion.cola.length === 0) {
    return (
      <section className="empty-state">
        <span className="empty-icon">✳</span><span className="eyebrow">{t('quiz.todaySession')}</span>
        <h2>{t('quiz.emptyTitle')}</h2>
        <p>{t('quiz.emptyText')}</p>
        <button className="button button-dark" onClick={advanceDay}>{t('date.advanceButton')}</button>
      </section>
    );
  }

  if (!pregunta) {
    return (
      <section className="summary-card">
        <span className="eyebrow">{t('quiz.sessionDone')}</span>
        <h2>{t('quiz.summaryTitle')}</h2>
        <p>{t('quiz.summaryText')}</p>
        <div className="summary-stats">
          <div><b>{sesion.aciertos}/{sesion.respondidas}</b><span>{t('quiz.correctAnswers')}</span></div>
          <div><b>{sesion.temas.size}</b><span>{t('quiz.topicsReviewed')}</span></div>
          <div><b>{sesion.proxima ? formatDate(sesion.proxima, i18n.language) : '—'}</b><span>{t('quiz.nextReview')}</span></div>
        </div>
        <div className="summary-ratings">
          {RATINGS.map(r => <span key={r} className={`rating-chip ${r}`}>{t(`rating.${r}`)}: {sesion.ratings[r]}</span>)}
        </div>
        <Link to="/" className="button button-dark">{t('common.backHome')}</Link>
      </section>
    );
  }

  const esNueva = pregunta.clase === 'nueva';
  const favorita = profile.starred.includes(pregunta.id);
  const total = sesion.cola.length;

  return (
    <>
      <section className="quiz-top">
        <div>
          <span className="eyebrow">{t('quiz.progress', { current: sesion.indice + 1, total })} · {esNueva ? t('quiz.newRecall') : t('quiz.scheduledReview')}</span>
          <div className="quiz-progress"><i style={{ width: `${Math.round(sesion.indice / total * 100)}%` }}></i></div>
        </div>
        <button className={`star-button ${favorita ? 'is-starred' : ''}`} data-action="star"
          aria-label={favorita ? t('quiz.unstar') : t('quiz.star')} onClick={() => toggleStar(pregunta.id)}>
          {favorita ? '★' : '☆'} <span>{favorita ? t('quiz.saved') : t('quiz.reviewLater')}</span>
        </button>
      </section>

      <article className="quiz-card" style={topicStyle(pregunta.tema.color)}>
        <div className="card-meta">
          <span className="topic-pill">{pregunta.tema.nombre}</span>
          <span>{esNueva ? t('quiz.new') : t('quiz.review')} · {t('common.dayN', { day: pregunta.dia })}</span>
        </div>
        <div className="question-tags">
          <span className="question-type">{esMultiple ? t('quiz.multipleChoice') : t('quiz.flashcard')}</span>
          <span className={`difficulty-badge difficulty-${pregunta.dificultad ?? 'intermedia'}`}>{t(`difficulty.${pregunta.dificultad ?? 'intermedia'}`)}</span>
          {pregunta.sinTraducir && <span className="untranslated">{t('lesson.untranslated')}</span>}
        </div>
        <h2>{pregunta.enunciado}</h2>

        {esMultiple ? (
          <>
            <div className="answer-options">
              {pregunta.opcionesMezcladas!.map(opcion => {
                const respondida = respuesta.seleccionada !== undefined;
                const estado = !respondida ? ''
                  : opcion === pregunta.respuestaCorrecta ? ' option-correct'
                    : opcion === respuesta.seleccionada ? ' option-incorrect' : '';
                return (
                  <button key={opcion} className={`option-button${estado}`} data-action="answer"
                    disabled={respondida} aria-pressed={opcion === respuesta.seleccionada}
                    onClick={() => responder(opcion)}>{opcion}</button>
                );
              })}
            </div>
            {respuesta.seleccionada !== undefined && (
              <div className="explanation">
                <b>{respuesta.correcta ? t('quiz.wellRecalled') : t('quiz.correctAnswer', { answer: pregunta.respuestaCorrecta })}</b>
                <p>{pregunta.explicacion}</p>
              </div>
            )}
          </>
        ) : (
          <div className={`flash-answer ${respuesta.revelada ? 'revealed' : ''}`}>
            {respuesta.revelada
              ? <><b>{pregunta.respuestaCorrecta}</b><p>{pregunta.explicacion}</p></>
              : <button className="button button-secondary" data-action="reveal" onClick={() => setRespuesta({ revelada: true })}>{t('quiz.showAnswer')} <span>↻</span></button>}
          </div>
        )}

        {puedeCalificar && (
          <section className="rating-panel">
            <div><b>{t('quiz.howWasIt')}</b><span>{t('quiz.ratingHelp')}</span></div>
            <div className="rating-buttons">
              {RATINGS.map((rating, i) => (
                <button key={rating} className={`rate-button rate-${rating}`} data-rating={rating} onClick={() => calificar(rating)}>
                  <b>{t(`rating.${rating}`)}</b>
                  <small>· {t('quiz.days', { count: estimateInterval(cards[pregunta.id], rating) })}</small>
                  <kbd>{i + 1}</kbd>
                </button>
              ))}
            </div>
          </section>
        )}
      </article>
      <p className="keyboard-hint">{t('quiz.shortcuts')}</p>
    </>
  );
}
