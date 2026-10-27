import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { addDays } from '../domain/dates';
import { buildDailyQueue, hardQuestionIds } from '../domain/queue';
import { streak } from '../domain/report';
import { topicStyle } from '../components/topic';
import { useProgress } from '../state/progress';

const porcentaje = (n: number, total: number) => total ? Math.round(n / total * 100) : 0;

export default function HomePage() {
  const { t } = useTranslation();
  const { syllabus, profile, cards, logs, currentDay } = useProgress();
  const totalDias = syllabus.dias.length;
  const totalPreguntas = syllabus.dias.reduce((suma, dia) => suma + dia.preguntas.length, 0);
  const vistas = Object.keys(cards).length;
  const pendientes = useMemo(
    () => buildDailyQueue(syllabus, cards, profile, currentDay).length,
    [syllabus, cards, profile, currentDay]
  );
  const racha = streak(logs, profile.simulatedDate, addDays);
  const dificiles = hardQuestionIds(profile, logs).size;

  // Mapa de actividad de los últimos 30 días.
  const actividad = Array.from({ length: 30 }, (_, i) => {
    const fecha = addDays(profile.simulatedDate, i - 29);
    const cantidad = logs.filter(log => log.studyDate === fecha).length;
    const nivel = cantidad === 0 ? 0 : cantidad < 3 ? 1 : cantidad < 6 ? 2 : 3;
    return { fecha, cantidad, nivel };
  });

  return (
    <>
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">{t('home.eyebrow')}</span>
          <h2>{t('home.title1')}<br /><em>{t('home.title2')}</em></h2>
          <p>{t('home.subtitle')}</p>
          <Link className="button button-dark" to="/estudiar">{t('home.studyToday')} <span>→</span></Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one"></div><div className="orbit orbit-two"></div>
          <div className="art-card"><span>↗</span><b>{t('home.artRecall')}</b><small>{t('home.artConnect')}</small></div>
          <div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✦</div>
        </div>
      </section>

      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-icon purple">▤</span>
          <span className="stat-label">{t('home.plan')}</span>
          <strong>{t('home.dayOf', { day: currentDay })} <small>{t('home.ofTotal', { total: totalDias })}</small></strong>
          <div className="mini-progress"><i style={{ width: `${porcentaje(currentDay, totalDias)}%` }}></i></div>
        </article>
        <article className="stat-card">
          <span className="stat-icon amber">♨</span>
          <span className="stat-label">{t('home.consistency')}</span>
          <strong>{racha} <small>{t('home.streakDays', { count: racha })}</small></strong>
          <p>{t('home.habit')}</p>
        </article>
        <article className="stat-card">
          <span className="stat-icon green">✳</span>
          <span className="stat-label">{t('home.today')}</span>
          <strong>{pendientes} <small>{t('home.pendingCards')}</small></strong>
          <Link to="/quiz" className="text-link">{t('home.startReview')}</Link>
        </article>
        <article className="stat-card">
          <span className="stat-icon blue">◷</span>
          <span className="stat-label">{t('home.totalProgress')}</span>
          <strong>{porcentaje(vistas, totalPreguntas)}<small>{t('home.completed')}</small></strong>
          <div className="mini-progress"><i style={{ width: `${porcentaje(vistas, totalPreguntas)}%` }}></i></div>
        </article>
      </div>

      <div className="home-actions">
        <Link className="button button-secondary" to="/quiz?modo=dificiles">{t('home.reviewHard', { count: dificiles })}</Link>
        <Link className="button button-secondary" to="/simulacro">{t('home.takeExam')}</Link>
        <Link className="text-link" to="/glosario">{t('home.exploreGlossary')}</Link>
      </div>

      <section className="panel activity-panel">
        <div className="section-heading">
          <div><span className="eyebrow">{t('home.consistency')}</span><h3>{t('home.activityTitle')}</h3></div>
          <span className="muted">{t('home.last30')}</span>
        </div>
        <div className="activity-map" role="img" aria-label={t('home.activityAria')}>
          {actividad.map(dia => (
            <span key={dia.fecha} title={t('home.activityCell', { date: dia.fecha, count: dia.cantidad })}
              className={`activity-cell level-${dia.nivel}`}></span>
          ))}
        </div>
        <div className="activity-legend">
          <span>{t('home.less')}</span>
          {[0, 1, 2, 3].map(n => <i key={n} className={`activity-cell level-${n}`}></i>)}
          <span>{t('home.more')}</span>
        </div>
      </section>

      <section className="section-heading topic-heading">
        <div><span className="eyebrow">{t('home.path')}</span><h3>{t('home.planTitle', { count: totalDias })}</h3></div>
        <Link className="text-link" to="/estudiar">{t('home.seeLesson')}</Link>
      </section>
      <div className="topic-grid">
        {syllabus.dias.map(dia => (
          <Link key={dia.dia} to={`/estudiar?dia=${dia.dia}`} className={`topic-card ${dia.dia === currentDay ? 'topic-current' : ''}`}>
            <span className="topic-number" style={topicStyle(dia.tema.color)}>{String(dia.dia).padStart(2, '0')}</span>
            <span><small>{t('common.dayN', { day: dia.dia })}</small><b>{dia.tema.nombre}</b></span>
            <span className="topic-arrow">↗</span>
          </Link>
        ))}
      </div>
    </>
  );
}
