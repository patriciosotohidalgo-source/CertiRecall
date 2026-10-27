import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AccuracyLine, StackedBars } from '../components/Charts';
import { topicStyle } from '../components/topic';
import { buildReport } from '../domain/report';
import { useProgress } from '../state/progress';

const PRIORIDADES = ['high', 'medium', 'moderate'] as const;

export default function ReportPage() {
  const { t } = useTranslation();
  const { syllabus, demoLogs, logs } = useProgress();
  const [fuente, setFuente] = useState<'demo' | 'mine'>('demo');
  const demo = fuente === 'demo';
  const registros = demo ? demoLogs : logs;
  const informe = useMemo(() => buildReport(registros, syllabus), [registros, syllabus]);

  const preguntas = useMemo(
    () => new Map(syllabus.dias.flatMap(dia => dia.preguntas.map(p => [p.id, p] as const))),
    [syllabus]
  );
  const temas = useMemo(() => new Map(syllabus.dias.map(dia => [dia.tema.id, dia.tema])), [syllabus]);
  const prioridades = informe.filas.filter(fila => fila.total > 0).slice(0, 3);

  return (
    <>
      <div className="report-toolbar">
        <div><span className="eyebrow">{t('report.eyebrow')}</span><h2>{t('report.title')}</h2></div>
        <label className="select-wrap">{t('report.source')}
          <select id="report-source" value={fuente} onChange={evento => setFuente(evento.target.value as 'demo' | 'mine')}>
            <option value="demo">{t('report.demoData')}</option>
            <option value="mine">{t('report.myData')}</option>
          </select>
        </label>
      </div>
      {demo && <div className="demo-note"><span>ⓘ</span> {t('report.demoNote')}</div>}

      {registros.length === 0 ? (
        <div className="empty-report">
          <h3>{t('report.emptyTitle')}</h3>
          <p>{t('report.emptyText')}</p>
          <Link className="button button-dark" to="/quiz">{t('report.goToQuiz')}</Link>
        </div>
      ) : (
        <>
          <section className="priority-section">
            <div className="section-heading">
              <div><span className="eyebrow">{t('report.growth')}</span><h3>{t('report.hardestTopics')}</h3></div>
              <span className="muted">{t('report.reviewPriority')}</span>
            </div>
            <div className="priority-grid">
              {prioridades.map((fila, i) => (
                <article key={fila.tema.id} className={`priority-card priority-${i + 1}`} style={topicStyle(fila.tema.color)}>
                  <span className="priority-rank">0{i + 1}</span>
                  <span className="eyebrow">{t(`report.priority.${PRIORIDADES[i]}`)}</span>
                  <h3>{fila.tema.nombre}</h3>
                  <div className="priority-score">{fila.score}<small>{t('report.index')}</small></div>
                  <p>{t('report.hardAndAccuracy', { hard: fila.dificil, accuracy: fila.acierto })}</p>
                </article>
              ))}
            </div>
            {prioridades[0] && (
              <p className="report-conclusion">
                {t('report.conclusion', { topic: prioridades[0].tema.nombre, percent: prioridades[0].dificil })}
              </p>
            )}
            <Link className="button button-secondary hard-review-link" to="/quiz?modo=dificiles">{t('report.reviewHard')}</Link>
          </section>

          <div className="report-grid">
            <section className="panel">
              <div className="section-heading"><div><span className="eyebrow">{t('report.distribution')}</span><h3>{t('report.byTopic')}</h3></div></div>
              <StackedBars filas={informe.filas} />
            </section>
            <section className="panel line-panel">
              <div className="section-heading"><div><span className="eyebrow">{t('report.trend')}</span><h3>{t('report.accuracyByDay')}</h3></div></div>
              <AccuracyLine dias={informe.dias} />
            </section>
          </div>

          <section className="panel table-panel">
            <div className="section-heading"><div><span className="eyebrow">{t('report.detail')}</span><h3>{t('report.progressByTopic')}</h3></div></div>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>{t('report.cols.topic')}</th><th>{t('report.cols.reviewed')}</th><th>{t('report.cols.accuracy')}</th>
                  <th>{t('report.cols.hard')}</th><th>{t('report.cols.time')}</th>
                </tr></thead>
                <tbody>
                  {informe.filas.map(fila => (
                    <tr key={fila.tema.id}>
                      <td><span className="table-theme" style={topicStyle(fila.tema.color)}></span>{fila.tema.nombre}</td>
                      <td>{fila.total}</td><td>{fila.acierto}%</td><td>{fila.dificil}%</td><td>{fila.tiempo} s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel failed-panel">
            <div className="section-heading"><div><span className="eyebrow">{t('report.tryAgain')}</span><h3>{t('report.mostMissed')}</h3></div></div>
            {informe.falladas.length === 0
              ? <p className="muted">{t('report.noMissed')}</p>
              : informe.falladas.map(item => {
                const pregunta = preguntas.get(item.questionId);
                if (!pregunta) return null;
                return (
                  <Link key={item.questionId} className="failed-row" to={`/quiz?pregunta=${item.questionId}`}>
                    <span className="failed-icon">↗</span>
                    <span><b>{pregunta.enunciado}</b><small>{temas.get(item.topicId)?.nombre} · {t('report.misses', { count: item.fallos })}</small></span>
                    <span className="failed-rating">{t(`rating.${item.ultima}`)}</span>
                  </Link>
                );
              })}
          </section>
        </>
      )}
    </>
  );
}
