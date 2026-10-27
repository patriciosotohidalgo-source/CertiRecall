import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { topicStyle } from '../components/topic';
import { useProgress } from '../state/progress';
import { useUi } from '../state/ui';

export default function LessonPage() {
  const { t } = useTranslation();
  const { syllabus, profile, currentDay, completeLesson } = useProgress();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Solo se pueden abrir lecciones ya desbloqueadas.
  const pedido = Number(params.get('dia')) || currentDay;
  const numero = Math.min(currentDay, Math.max(1, pedido));
  const dia = syllabus.dias[numero - 1];
  const leccion = dia.leccion;
  const resumen = Array.isArray(leccion.resumen) ? leccion.resumen : [leccion.resumen];

  const irAlCuestionario = () => {
    completeLesson(numero);
    navigate('/quiz');
  };

  const copiar = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      toast(t('lesson.copied'));
    } catch {
      toast(t('lesson.copyFailed'), 'error');
    }
  };

  return (
    <>
      <section className="lesson-banner" style={topicStyle(dia.tema.color)}>
        <span className="eyebrow">{t('common.dayN', { day: dia.dia })} · {dia.tema.nombre}</span>
        {dia.sinTraducir && <span className="untranslated">{t('lesson.untranslated')}</span>}
        <h2>{leccion.titulo}</h2>
        <div className="lesson-summary">{resumen.map((parrafo, i) => <p key={i}>{parrafo}</p>)}</div>
        <div className="lesson-progress">
          <span>{profile.completedLessons.includes(dia.dia) ? t('lesson.studied') : t('lesson.inProgress')}</span>
          <span>{dia.dia} / {syllabus.dias.length}</span>
        </div>
      </section>

      <div className="lesson-layout">
        <article className="panel lesson-content">
          <span className="eyebrow">{t('lesson.keyIdeas')}</span>
          <h3>{t('lesson.remember')}</h3>
          <ul className="key-points">
            {leccion.puntosClave.map((punto, i) => <li key={i}><span>✓</span>{punto}</li>)}
          </ul>
          <div className="recall-note">
            <span>✳</span>
            <p><b>{t('lesson.recallTitle')}</b><br />{t('lesson.recallText')}</p>
          </div>
          <button className="button button-dark" data-action="start-quiz" onClick={irAlCuestionario}>
            {t('lesson.goToQuiz')} <span>→</span>
          </button>
        </article>

        <aside className="panel day-picker">
          <div className="section-heading">
            <div><span className="eyebrow">{t('lesson.route')}</span><h3>{t('lesson.routeTitle', { count: syllabus.dias.length })}</h3></div>
          </div>
          {syllabus.dias.map(item => {
            const disponible = item.dia <= currentDay;
            return (
              <button key={item.dia} className={`day-row ${item.dia === dia.dia ? 'selected' : ''}`}
                disabled={!disponible} onClick={() => setParams({ dia: String(item.dia) })}>
                <span className="day-badge" style={topicStyle(item.tema.color)}>{String(item.dia).padStart(2, '0')}</span>
                <span><b>{t('common.dayN', { day: item.dia })}</b><small>{item.tema.nombre}</small></span>
                <span>{profile.completedLessons.includes(item.dia) ? '✓' : disponible ? '→' : '•'}</span>
              </button>
            );
          })}
        </aside>
      </div>

      {!!leccion.conceptos?.length && (
        <section className="lesson-extra">
          <div className="section-heading">
            <div><span className="eyebrow">{t('lesson.concepts')}</span><h3>{t('lesson.conceptsTitle')}</h3></div>
          </div>
          <div className="concept-grid">
            {leccion.conceptos.map(concepto => (
              <article key={concepto.termino} className="concept-card" style={topicStyle(dia.tema.color)}>
                <h4>{concepto.termino}</h4>
                <p>{concepto.definicion}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {leccion.ejemplo && (
        <section className="panel code-example">
          <div className="section-heading">
            <div><span className="eyebrow">{t('lesson.practice')}</span><h3>{leccion.ejemplo.titulo}</h3></div>
            <button className="button button-secondary" onClick={() => copiar(leccion.ejemplo!.codigo)}>{t('lesson.copy')}</button>
          </div>
          <pre><code>{leccion.ejemplo.codigo}</code></pre>
          <span className="muted">{leccion.ejemplo.lenguaje}</span>
        </section>
      )}

      {!!leccion.erroresComunes?.length && (
        <section className="panel lesson-mistakes">
          <span className="eyebrow">{t('lesson.avoid')}</span>
          <h3>{t('lesson.mistakes')}</h3>
          <ul>{leccion.erroresComunes.map((error, i) => <li key={i}>{error}</li>)}</ul>
        </section>
      )}

      {!!leccion.fuentes?.length && (
        <section className="panel lesson-sources">
          <span className="eyebrow">{t('lesson.deeper')}</span>
          <h3>{t('lesson.sources')}</h3>
          <ul>
            {leccion.fuentes.map(fuente => (
              <li key={fuente.url}><a href={fuente.url} target="_blank" rel="noreferrer">{fuente.titulo} ↗</a></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
