export const etiquetas = {
  otra_vez: 'Otra vez',
  dificil: 'Difícil',
  bien: 'Bien',
  facil: 'Fácil'
};

const porcentaje = (cantidad, total) => total ? Math.round(cantidad / total * 100) : 0;
const escaparHTML = texto => String(texto).replace(/[&<>"']/g, caracter => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[caracter]);

export function calcularReporte(registros, temario) {
  const filas = temario.dias.map(({ tema }) => {
    const eventos = registros.filter(registro => registro.temaId === tema.id);
    const total = eventos.length;
    const aciertos = eventos.filter(registro => registro.acierto).length;
    const dificiles = eventos.filter(registro =>
      ['dificil', 'otra_vez'].includes(registro.calificacion)
    ).length;
    const acierto = porcentaje(aciertos, total);
    const dificil = porcentaje(dificiles, total);
    const conteos = Object.fromEntries(
      Object.keys(etiquetas).map(clave => [
        clave,
        eventos.filter(registro => registro.calificacion === clave).length
      ])
    );

    return {
      tema,
      total,
      acierto,
      dificil,
      score: Math.round((dificil + 100 - acierto) / 2),
      tiempos: total
        ? Math.round(eventos.reduce((suma, evento) => suma + (evento.tiempoSeg || 0), 0) / total)
        : 0,
      conteos
    };
  }).sort((a, b) => b.score - a.score);

  const porFecha = registros.reduce((grupos, registro) => {
    (grupos[registro.fecha] ||= []).push(registro);
    return grupos;
  }, {});
  const dias = Object.entries(porFecha)
    .sort(([fechaA], [fechaB]) => fechaA.localeCompare(fechaB))
    .map(([fecha, eventos]) => ({
      fecha,
      acierto: porcentaje(eventos.filter(evento => evento.acierto).length, eventos.length)
    }));

  const preguntasFalladas = registros
    .filter(registro => !registro.acierto)
    .reduce((grupos, registro) => {
      const pregunta = grupos.get(registro.preguntaId) || {
        preguntaId: registro.preguntaId,
        temaId: registro.temaId,
        fallos: 0,
        ultimaCalificacion: registro.calificacion
      };
      pregunta.fallos += 1;
      pregunta.ultimaCalificacion = registro.calificacion;
      grupos.set(registro.preguntaId, pregunta);
      return grupos;
    }, new Map());

  return {
    filas,
    dias,
    falladas: [...preguntasFalladas.values()]
      .sort((a, b) => b.fallos - a.fallos)
      .slice(0, 8)
  };
}

export function renderReporte({ registros, temario, demo = false }) {
  const informe = calcularReporte(registros, temario);
  const totalRegistros = registros.length;
  const todosTemas = new Map(temario.dias.map(dia => [dia.tema.id, dia.tema]));
  const preguntas = new Map(
    temario.dias.flatMap(dia => dia.preguntas.map(pregunta => [pregunta.id, pregunta]))
  );
  const linePoints = informe.dias.map((dia, indice) => {
    const x = informe.dias.length < 2 ? 50 : indice / (informe.dias.length - 1) * 100;
    return `${x},${100 - dia.acierto}`;
  }).join(' ');

  const notaDemo = demo
    ? '<div class="demo-note"><span>ⓘ</span> Datos simulados con fines ilustrativos. No representan resultados reales.</div>'
    : '';

  if (!totalRegistros) {
    return `${notaDemo}
      <div class="empty-report">
        <h3>Aún no hay datos propios</h3>
        <p>Completa algunas sesiones de estudio y vuelve aquí para ver tu progreso.</p>
        <a class="button button-dark" href="#quiz">Ir al cuestionario →</a>
      </div>`;
  }

  const prioridades = informe.filas.slice(0, 3);
  const prioridadLabel = ['ALTA', 'MEDIA', 'MODERADA'];
  const tarjetaPrioridad = prioridades.map((fila, indice) => `
    <article class="priority-card priority-${indice + 1}" style="--topic:${fila.tema.color}">
      <span class="priority-rank">0${indice + 1}</span>
      <span class="eyebrow">PRIORIDAD ${prioridadLabel[indice]}</span>
      <h3>${escaparHTML(fila.tema.nombre)}</h3>
      <div class="priority-score">${fila.score}<small>índice</small></div>
      <p>${fila.dificil}% difícil · ${fila.acierto}% de acierto</p>
    </article>`).join('');

  const barras = informe.filas.map(fila => {
    const total = Math.max(1, fila.total);
    const segmentos = Object.entries(fila.conteos).map(([clave, cantidad]) =>
      cantidad
        ? `<i class="segment ${clave}" style="width:${cantidad / total * 100}%" title="${etiquetas[clave]}: ${cantidad}"></i>`
        : ''
    ).join('');
    const descripcion = Object.entries(fila.conteos)
      .map(([clave, cantidad]) => `${etiquetas[clave]} ${cantidad}`)
      .join(', ');
    return `<div class="bar-row">
      <span class="bar-label">${escaparHTML(fila.tema.nombre)}</span>
      <div class="stacked-bar" aria-label="${fila.tema.nombre}: ${descripcion}">${segmentos}</div>
      <span class="bar-count">${fila.total}</span>
    </div>`;
  }).join('');

  const graficoLinea = informe.dias.length > 1
    ? `<svg class="line-chart" viewBox="0 0 100 100" role="img" aria-label="Porcentaje de acierto por día">
        <line x1="0" y1="25" x2="100" y2="25"></line>
        <line x1="0" y1="50" x2="100" y2="50"></line>
        <line x1="0" y1="75" x2="100" y2="75"></line>
        <polyline points="${linePoints}"></polyline>
        ${informe.dias.map((dia, indice) => {
          const x = indice / (informe.dias.length - 1) * 100;
          return `<circle cx="${x}" cy="${100 - dia.acierto}" r="1.5"><title>${dia.fecha}: ${dia.acierto}%</title></circle>`;
        }).join('')}
      </svg>
      <div class="chart-axis"><span>${informe.dias[0].fecha}</span><span>${informe.dias.at(-1).fecha}</span></div>`
    : '<div class="chart-empty">Necesitas al menos dos días de actividad para ver una tendencia.</div>';

  const tabla = informe.filas.map(fila => `
    <tr>
      <td><span class="table-theme" style="--topic:${fila.tema.color}"></span>${escaparHTML(fila.tema.nombre)}</td>
      <td>${fila.total}</td><td>${fila.acierto}%</td><td>${fila.dificil}%</td><td>${fila.tiempos} s</td>
    </tr>`).join('');

  const falladas = informe.falladas.map(registro => {
    const pregunta = preguntas.get(registro.preguntaId);
    const tema = todosTemas.get(registro.temaId);
    if (!pregunta) return '';
    return `<a class="failed-row" href="#quiz?modo=dificiles" data-review-question="${pregunta.id}">
      <span class="failed-icon">↗</span>
      <span><b>${escaparHTML(pregunta.enunciado)}</b><small>${escaparHTML(tema?.nombre || registro.temaId)} · ${registro.fallos} ${registro.fallos === 1 ? 'fallo' : 'fallos'}</small></span>
      <span class="failed-rating">${etiquetas[registro.ultimaCalificacion] || 'Repasar'}</span>
    </a>`;
  }).join('');

  const conclusion = prioridades[0];
  const conclusionTexto = conclusion
    ? `Tu tema más complejo es <b>${escaparHTML(conclusion.tema.nombre)}</b>: el ${conclusion.dificil}% de sus preguntas fue marcado como difícil o «otra vez». Recomendación: repasa su lección y programa una sesión corta.`
    : 'Completa algunas preguntas para recibir una recomendación de repaso.';

  return `${notaDemo}
    <section class="priority-section">
      <div class="section-heading"><div><span class="eyebrow">DONDE MÁS CRECES</span><h3>Temas más complejos</h3></div><span class="muted">Prioridad de repaso</span></div>
      <div class="priority-grid">${tarjetaPrioridad}</div>
      <p class="report-conclusion">${conclusionTexto}</p>
      <a class="button button-secondary hard-review-link" href="#quiz?modo=dificiles">Repasar mis preguntas difíciles →</a>
    </section>
    <div class="report-grid">
      <section class="panel">
        <div class="section-heading"><div><span class="eyebrow">DISTRIBUCIÓN</span><h3>Cómo te fue por tema</h3></div></div>
        <div class="chart-legend">${Object.entries(etiquetas).map(([key, label]) => `<span><i class="legend-dot ${key}"></i>${label}</span>`).join('')}</div>
        <div class="stacked-chart">${barras}</div>
      </section>
      <section class="panel line-panel">
        <div class="section-heading"><div><span class="eyebrow">TENDENCIA</span><h3>Acierto por día</h3></div></div>
        ${graficoLinea}
      </section>
    </div>
    <section class="panel table-panel">
      <div class="section-heading"><div><span class="eyebrow">DETALLE</span><h3>Tu avance por tema</h3></div></div>
      <div class="table-scroll"><table><thead><tr><th>Tema</th><th>Repasadas</th><th>Acierto</th><th>Difícil</th><th>Tiempo medio</th></tr></thead><tbody>${tabla}</tbody></table></div>
    </section>
    <section class="panel failed-panel">
      <div class="section-heading"><div><span class="eyebrow">PARA VOLVER A INTENTAR</span><h3>Preguntas que costaron más</h3></div></div>
      ${falladas || '<p class="muted">Todavía no hay preguntas falladas.</p>'}
    </section>`;
}
