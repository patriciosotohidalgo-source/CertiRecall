import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { topicStyle } from '../components/topic';
import { useProgress } from '../state/progress';

export default function GlossaryPage() {
  const { t, i18n } = useTranslation();
  const { syllabus } = useProgress();
  const [consulta, setConsulta] = useState('');

  const conceptos = useMemo(() => syllabus.dias.flatMap(dia =>
    (dia.leccion.conceptos ?? []).map(concepto => ({ ...concepto, tema: dia.tema }))), [syllabus]);
  const texto = consulta.toLocaleLowerCase(i18n.language);
  const filtrados = conceptos.filter(c =>
    `${c.termino} ${c.definicion} ${c.tema.nombre}`.toLocaleLowerCase(i18n.language).includes(texto));

  return (
    <>
      <section className="settings-intro">
        <span className="eyebrow">{t('glossary.eyebrow')}</span><h2>{t('glossary.title')}</h2>
        <p>{t('glossary.count', { count: conceptos.length })}</p>
      </section>
      <label className="glossary-search">{t('glossary.search')}
        <input id="glossary-search" type="search" value={consulta} placeholder={t('glossary.placeholder')}
          onChange={evento => setConsulta(evento.target.value)} />
      </label>
      <div id="glossary-results" className="concept-grid glossary-grid">
        {filtrados.length === 0
          ? <p className="empty-glossary">{t('glossary.empty')}</p>
          : filtrados.map(c => (
            <article key={`${c.tema.id}-${c.termino}`} className="concept-card" style={topicStyle(c.tema.color)}>
              <span className="eyebrow">{c.tema.nombre}</span>
              <h3>{c.termino}</h3>
              <p>{c.definicion}</p>
            </article>
          ))}
      </div>
    </>
  );
}
