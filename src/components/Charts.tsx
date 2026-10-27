import { useTranslation } from 'react-i18next';
import type { TopicRow } from '../domain/report';
import { RATINGS } from '../domain/types';

/** Barras apiladas por tema: distribución de calificaciones. */
export function StackedBars({ filas }: { filas: TopicRow[] }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="chart-legend">
        {RATINGS.map(r => <span key={r}><i className={`legend-dot ${r}`}></i>{t(`rating.${r}`)}</span>)}
      </div>
      <div className="stacked-chart">
        {filas.map(fila => {
          const total = Math.max(1, fila.total);
          const descripcion = RATINGS.map(r => `${t(`rating.${r}`)} ${fila.conteos[r]}`).join(', ');
          return (
            <div key={fila.tema.id} className="bar-row">
              <span className="bar-label">{fila.tema.nombre}</span>
              <div className="stacked-bar" aria-label={`${fila.tema.nombre}: ${descripcion}`}>
                {RATINGS.map(r => fila.conteos[r] > 0 && (
                  <i key={r} className={`segment ${r}`} style={{ width: `${fila.conteos[r] / total * 100}%` }}
                    title={`${t(`rating.${r}`)}: ${fila.conteos[r]}`}></i>
                ))}
              </div>
              <span className="bar-count">{fila.total}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Lienzo de 300×100 para que el gráfico sea más ancho que alto.
const ANCHO = 300;

/** Línea de % de acierto por día. */
export function AccuracyLine({ dias }: { dias: { fecha: string; acierto: number }[] }) {
  const { t } = useTranslation();
  if (dias.length < 2) return <div className="chart-empty">{t('report.needTwoDays')}</div>;
  const x = (i: number) => i / (dias.length - 1) * ANCHO;
  return (
    <>
      <svg className="line-chart" viewBox="-22 -6 330 112" role="img" aria-label={t('report.accuracyAria')}>
        {[0, 50, 100].map(valor => (
          <g key={valor}>
            <line x1="0" y1={100 - valor} x2={ANCHO} y2={100 - valor}></line>
            <text x="-5" y={103 - valor} textAnchor="end">{valor}%</text>
          </g>
        ))}
        <polyline points={dias.map((dia, i) => `${x(i)},${100 - dia.acierto}`).join(' ')}></polyline>
        {dias.map((dia, i) => (
          <circle key={dia.fecha} cx={x(i)} cy={100 - dia.acierto} r="2.4"><title>{`${dia.fecha}: ${dia.acierto}%`}</title></circle>
        ))}
      </svg>
      <div className="chart-axis"><span>{dias[0].fecha}</span><span>{dias.at(-1)!.fecha}</span></div>
    </>
  );
}
