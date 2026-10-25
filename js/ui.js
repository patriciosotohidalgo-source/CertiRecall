import { intervaloEstimado } from './scheduler.js';

const calificaciones = [
  ['otra_vez', 'Otra vez'],
  ['dificil', 'Difícil'],
  ['bien', 'Bien'],
  ['facil', 'Fácil']
];
const nivelesDificultad = {
  basica: 'Básica',
  intermedia: 'Intermedia',
  avanzada: 'Avanzada'
};

export function mostrarToast(texto, tipo = '') {
  const region = document.querySelector('#toast-region');
  const elemento = document.createElement('div');
  elemento.className = `toast ${tipo}`;
  elemento.textContent = texto;
  region.append(elemento);
  setTimeout(() => elemento.remove(), 3400);
}

export function porcentaje(cantidad, total) {
  return total ? Math.round(cantidad / total * 100) : 0;
}

export function renderHome({ temario, progreso, dia, racha, pendientes }) {
  const totalPreguntas = contarPreguntas(temario);
  const hechas = Object.keys(progreso.schedules).length;
  const actividad = crearActividad(progreso);
  const preguntasDificiles = contarPreguntasDificiles(progreso);

  return `
    <section class="hero-card">
      <div class="hero-copy">
        <span class="eyebrow">TU PLAN DE HOY</span>
        <h2>Un poco cada día.<br><em>Mucho más que memorizar.</em></h2>
        <p>Recuerda activamente y vuelve a cada idea justo cuando la necesitas.</p>
        <a class="button button-dark" href="#estudiar">Estudiar lección de hoy <span>→</span></a>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
        <div class="art-card"><span>↗</span><b>RECUERDA</b><small>y conecta ideas</small></div>
        <div class="art-spark spark-one">✳</div><div class="art-spark spark-two">✦</div>
      </div>
    </section>
    <div class="stats-grid">
      <article class="stat-card">
        <span class="stat-icon purple">▤</span>
        <span class="stat-label">PLAN DE ESTUDIO</span>
        <strong>Día ${dia} <small>de ${temario.dias.length}</small></strong>
        <div class="mini-progress"><i style="width:${Math.round(dia / temario.dias.length * 100)}%"></i></div>
      </article>
      <article class="stat-card">
        <span class="stat-icon amber">♨</span>
        <span class="stat-label">TU CONSTANCIA</span>
        <strong>${racha} <small>${racha === 1 ? 'día' : 'días'} de racha</small></strong>
        <p>Un hábito se construye vuelta a vuelta.</p>
      </article>
      <article class="stat-card">
        <span class="stat-icon green">✳</span>
        <span class="stat-label">PARA HOY</span>
        <strong>${pendientes} <small>tarjetas pendientes</small></strong>
        <a href="#quiz" class="text-link">Empezar repaso →</a>
      </article>
      <article class="stat-card">
        <span class="stat-icon blue">◷</span>
        <span class="stat-label">PROGRESO TOTAL</span>
        <strong>${porcentaje(hechas, totalPreguntas)}<small>% completado</small></strong>
        <div class="mini-progress"><i style="width:${porcentaje(hechas, totalPreguntas)}%"></i></div>
      </article>
    </div>
    <div class="home-actions">
      <a class="button button-secondary" href="#quiz?modo=dificiles">Repasar mis preguntas difíciles (${preguntasDificiles})</a>
      <a class="button button-secondary" href="#simulacro">Hacer simulacro de examen →</a>
      <a class="text-link" href="#glosario">Explorar glosario →</a>
    </div>
    <section class="panel activity-panel">
      <div class="section-heading"><div><span class="eyebrow">TU CONSTANCIA</span><h3>Un mapa de lo que recuerdas</h3></div><span class="muted">Últimos 30 días</span></div>
      <div class="activity-map" role="img" aria-label="Actividad de estudio de los últimos 30 días">${actividad}</div>
      <div class="activity-legend">
        <span>Menos</span><i class="activity-cell level-0"></i>
        <i class="activity-cell level-1"></i><i class="activity-cell level-2"></i>
        <i class="activity-cell level-3"></i><span>Más</span>
      </div>
    </section>
    <section class="section-heading topic-heading"><div><span class="eyebrow">EL CAMINO</span><h3>Tu plan de ${temario.dias.length} días</h3></div><a class="text-link" href="#estudiar">Ver lección →</a></section>
    <div class="topic-grid">${temario.dias.map(diaTemario => `
      <a href="#estudiar?dia=${diaTemario.dia}" class="topic-card ${diaTemario.dia === dia ? 'topic-current' : ''}">
        <span class="topic-number" style="--topic:${diaTemario.tema.color}">${String(diaTemario.dia).padStart(2, '0')}</span>
        <span><small>DÍA ${diaTemario.dia}</small><b>${diaTemario.tema.nombre}</b></span><span class="topic-arrow">↗</span>
      </a>`).join('')}
    </div>`;
}

function contarPreguntas(temario) {
  return temario.dias.reduce((total, dia) => total + dia.preguntas.length, 0);
}

function crearActividad(progreso) {
  return Array.from({ length: 30 }, (_, indice) => {
    const fecha = new Date(`${progreso.simulatedDate}T12:00:00`);
    fecha.setDate(fecha.getDate() - 29 + indice);
    const dia = fecha.toISOString().slice(0, 10);
    const cantidad = progreso.activity.filter(item => item.fecha === dia).length;
    const nivel = cantidad === 0 ? 0 : cantidad < 3 ? 1 : cantidad < 6 ? 2 : 3;
    return `<span title="${dia}: ${cantidad} repasos" class="activity-cell level-${nivel}"></span>`;
  }).join('');
}

function contarPreguntasDificiles(progreso) {
  const ids = new Set(progreso.starred);
  Object.entries(progreso.schedules).forEach(([id, registro]) => {
    if (registro.historial?.some(item => ['dificil', 'otra_vez'].includes(item.calificacion))) {
      ids.add(id);
    }
  });
  return ids.size;
}

export function renderLesson(dia, totalDias, completados, temario, desbloqueado) {
  const leccion = dia.leccion;
  const conceptos = leccion.conceptos?.length
    ? `<section class="lesson-extra"><div class="section-heading"><div><span class="eyebrow">CONCEPTOS CLAVE</span><h3>Glosario del tema</h3></div></div><div class="concept-grid">${leccion.conceptos.map(concepto => `
      <article class="concept-card">
        <h4>${escaparHTML(concepto.termino)}</h4>
        <p>${escaparHTML(concepto.definicion)}</p>
      </article>`).join('')}</div></section>`
    : '';
  const ejemplo = leccion.ejemplo
    ? `<section class="panel code-example">
        <div class="section-heading">
          <div><span class="eyebrow">EN LA PRÁCTICA</span><h3>${leccion.ejemplo.titulo}</h3></div>
          <button class="button button-secondary" data-action="copy-code">Copiar</button>
        </div>
        <pre><code>${escaparHTML(leccion.ejemplo.codigo)}</code></pre>
        <textarea class="code-source" hidden>${leccion.ejemplo.codigo}</textarea>
        <span class="muted">${leccion.ejemplo.lenguaje}</span>
      </section>`
    : '';
  const errores = leccion.erroresComunes?.length
    ? `<section class="panel lesson-mistakes"><span class="eyebrow">EVITA ESTOS TROPIEZOS</span><h3>Errores comunes</h3><ul>${leccion.erroresComunes.map(error => `<li>${escaparHTML(error)}</li>`).join('')}</ul></section>`
    : '';
  const fuentes = leccion.fuentes?.length
    ? `<section class="panel lesson-sources">
        <span class="eyebrow">PARA PROFUNDIZAR</span><h3>Fuentes oficiales</h3>
        <ul>${leccion.fuentes.map(fuente =>
          `<li><a href="${escaparHTML(fuente.url)}" target="_blank" rel="noreferrer">${escaparHTML(fuente.titulo)} ↗</a></li>`
        ).join('')}</ul>
      </section>`
    : '';

  return `
    <section class="lesson-banner" style="--topic:${dia.tema.color}">
      <span class="eyebrow">DÍA ${dia.dia} · ${escaparHTML(dia.tema.nombre)}</span>
      <h2>${escaparHTML(leccion.titulo)}</h2>
      <div class="lesson-summary">${(Array.isArray(leccion.resumen) ? leccion.resumen : [leccion.resumen]).map(parrafo => `<p>${escaparHTML(parrafo)}</p>`).join('')}</div>
      <div class="lesson-progress"><span>${completados.includes(dia.dia) ? 'Lección estudiada' : 'Lección en curso'}</span><span>${dia.dia} / ${totalDias}</span></div>
    </section>
    <div class="lesson-layout">
      <article class="panel lesson-content">
        <span class="eyebrow">IDEAS CLAVE</span><h3>Qué debes recordar</h3>
        <ul class="key-points">${leccion.puntosClave.map(punto => `<li><span>✓</span>${punto}</li>`).join('')}</ul>
        <div class="recall-note"><span>✳</span><p><b>Prueba de recuerdo activo</b><br>Antes de seguir, intenta explicar estas ideas con tus propias palabras.</p></div>
        <button class="button button-dark" data-action="start-quiz">Ya estudié, ir al cuestionario <span>→</span></button>
      </article>
      <aside class="panel day-picker"><div class="section-heading"><div><span class="eyebrow">TU RUTA</span><h3>${totalDias} días, ${totalDias} ideas</h3></div></div>
        ${temario.map((item, indice) => {
          const numero = indice + 1;
          const disponible = numero <= desbloqueado;
          return `<button class="day-row ${numero === dia.dia ? 'selected' : ''}" data-action="select-day" data-day="${numero}" ${disponible ? '' : 'disabled'}>
            <span class="day-badge" style="--topic:${item.tema.color}">${String(numero).padStart(2, '0')}</span>
            <span><b>Día ${numero}</b><small>${escaparHTML(item.tema.nombre)}</small></span>
            <span>${completados.includes(numero) ? '✓' : disponible ? '→' : '•'}</span>
          </button>`;
        }).join('')}
      </aside>
    </div>
    ${conceptos}${ejemplo}${errores}${fuentes}`;
}

function escaparHTML(texto) {
  return texto.replace(/[&<>"']/g, caracter => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[caracter]);
}

export function renderQuiz(pregunta, indice, total, progreso, favorito) {
  if (!pregunta) {
    return `<section class="empty-state">
      <span class="empty-icon">✳</span><span class="eyebrow">SESIÓN DE HOY</span>
      <h2>Tu mente está al día.</h2>
      <p>No hay preguntas pendientes. Avanza un día para desbloquear contenido nuevo o vuelve mañana.</p>
      <button class="button button-dark" data-action="advance-day">Avanzar al día siguiente →</button>
    </section>`;
  }

  const esNueva = pregunta.clase === 'nueva';
  const botonesCalificacion = calificaciones.map(([id, etiqueta], posicion) => {
    const dias = intervaloEstimado(progreso.schedules[pregunta.id], id);
    return `<button class="rate-button rate-${id}" data-action="rate" data-rating="${id}"><b>${etiqueta}</b><small>· ${dias} d</small><kbd>${posicion + 1}</kbd></button>`;
  }).join('');
  const contenido = pregunta.tipo === 'opcion_multiple'
    ? renderOpciones(pregunta)
    : renderFlashcard(pregunta);
  const permiteCalificar = pregunta.tipo === 'flashcard'
    ? pregunta.revealed
    : pregunta.answered;
  const nivel = nivelesDificultad[pregunta.dificultad] || nivelesDificultad.intermedia;
  const etiquetaModo = pregunta.clase === 'simulacro'
    ? 'SIMULACRO'
    : esNueva ? 'RECUERDO NUEVO' : 'REPASO PROGRAMADO';

  return `
    <section class="quiz-top">
      <div><span class="eyebrow">${indice + 1} DE ${total} · ${etiquetaModo}</span><div class="quiz-progress"><i style="width:${Math.round(indice / total * 100)}%"></i></div></div>
      ${pregunta.clase === 'simulacro' ? '' : `
        <button class="star-button ${favorito ? 'is-starred' : ''}" data-action="star"
          aria-label="${favorito ? 'Quitar de revisión' : 'Marcar para revisar'}">
          ${favorito ? '★' : '☆'} <span>${favorito ? 'Guardada' : 'Revisar después'}</span>
        </button>`}
    </section>
    <article class="quiz-card" style="--topic:${pregunta.tema.color}">
      <div class="card-meta"><span class="topic-pill">${escaparHTML(pregunta.tema.nombre)}</span><span>${esNueva ? 'Nuevo' : 'Repaso'} · Día ${pregunta.dia}</span></div>
      <div class="question-tags">
        <span class="question-type">${pregunta.tipo === 'opcion_multiple' ? 'OPCIÓN MÚLTIPLE' : 'FLASHCARD'}</span>
        <span class="difficulty-badge difficulty-${pregunta.dificultad || 'intermedia'}">${nivel}</span>
      </div>
      <h2>${escaparHTML(pregunta.enunciado)}</h2>${contenido}
      ${permiteCalificar && pregunta.clase !== 'simulacro' ? `
        <section class="rating-panel">
          <div><b>¿Cómo te resultó?</b><span>Tu respuesta define cuándo volverás a verla.</span></div>
          <div class="rating-buttons">${botonesCalificacion}</div>
        </section>` : ''}
    </article>
    ${pregunta.clase === 'simulacro' ? '' : '<p class="keyboard-hint">Atajos: <kbd>1</kbd>–<kbd>4</kbd> calificar <span>·</span> <kbd>Espacio</kbd> mostrar respuesta</p>'}`;
}

function renderOpciones(pregunta) {
  return `<div class="answer-options">${pregunta.opcionesMezcladas.map(opcion => {
    let estado = '';
    if (pregunta.answered && opcion === pregunta.respuestaCorrecta) estado = ' option-correct';
    else if (pregunta.answered && opcion === pregunta.seleccionada) estado = ' option-incorrect';
    const seleccionada = opcion === pregunta.seleccionada ? ' aria-pressed="true"' : '';
    return `    <button class="option-button${estado}" data-action="answer" data-answer="${encodeURIComponent(opcion)}" ${pregunta.answered ? 'disabled' : ''}${seleccionada}>${escaparHTML(opcion)}</button>`;
  }).join('')}</div>
  ${pregunta.answered ? `<div class="explanation"><b>${pregunta.correct ? '¡Bien recordado!' : `Respuesta correcta: ${escaparHTML(pregunta.respuestaCorrecta)}`}</b><p>${escaparHTML(pregunta.explicacion)}</p></div>` : ''}`;
}

function renderFlashcard(pregunta) {
  return `<div class="flash-answer ${pregunta.revealed ? 'revealed' : ''}">
    ${pregunta.revealed
      ? `<b>${escaparHTML(pregunta.respuestaCorrecta)}</b><p>${escaparHTML(pregunta.explicacion)}</p>`
      : '<button class="button button-secondary" data-action="reveal">Mostrar respuesta <span>↻</span></button>'}
  </div>`;
}

export function renderSummary(resumen) {
  return `<section class="summary-card"><span class="eyebrow">SESIÓN COMPLETADA</span><h2>Buen trabajo. Ya hiciste lo más difícil.</h2><p>Hacer el esfuerzo de recordar consolida el aprendizaje.</p>
    <div class="summary-stats">
      <div><b>${resumen.aciertos}/${resumen.total}</b><span>respuestas correctas</span></div>
      <div><b>${resumen.temas.length}</b><span>temas repasados</span></div>
      <div><b>${resumen.proxima || '—'}</b><span>próximo repaso</span></div>
    </div>
    <div class="summary-ratings">${calificaciones.map(([id, etiqueta]) => `<span class="rating-chip ${id}">${etiqueta}: ${resumen.ratings[id] || 0}</span>`).join('')}</div>
    <a href="#inicio" class="button button-dark">Volver al inicio →</a></section>`;
}

export function renderGlosario(temario, consulta = '') {
  const conceptos = temario.dias.flatMap(dia =>
    (dia.leccion.conceptos || []).map(concepto => ({ ...concepto, tema: dia.tema }))
  );
  const filtrados = conceptos.filter(concepto =>
    `${concepto.termino} ${concepto.definicion} ${concepto.tema.nombre}`
      .toLocaleLowerCase('es')
      .includes(consulta.toLocaleLowerCase('es'))
  );
  return `<section class="settings-intro">
      <span class="eyebrow">CONSULTA RÁPIDA</span><h2>Glosario de Claude</h2>
      <p>${conceptos.length} conceptos reunidos de todas las lecciones.</p>
    </section>
    <label class="glossary-search">Buscar un concepto<input id="glossary-search" type="search" value="${escaparHTML(consulta)}" placeholder="Ej. tool_use, embeddings, caché"></label>
    <div id="glossary-results" class="concept-grid glossary-grid">
      ${filtrados.map(concepto => `
        <article class="concept-card" style="--topic:${concepto.tema.color}">
          <span class="eyebrow">${concepto.tema.nombre}</span>
          <h3>${escaparHTML(concepto.termino)}</h3>
          <p>${escaparHTML(concepto.definicion)}</p>
        </article>`).join('') || '<p class="empty-glossary">No encontramos conceptos con esa búsqueda.</p>'}
    </div>`;
}

export function renderSimulacro(pregunta, indice, total, respuestas, segundosRestantes) {
  if (!pregunta) {
    return `<section class="empty-state"><span class="eyebrow">SIMULACRO</span><h2>No hay preguntas desbloqueadas</h2><p>Avanza el plan para desbloquear temas y volver a intentarlo.</p></section>`;
  }
  const botonSiguiente = indice + 1 === total
    ? '<button class="button button-dark" data-action="exam-finish">Terminar simulacro</button>'
    : '<button class="button button-dark" data-action="exam-next">Siguiente →</button>';
  const opciones = pregunta.opcionesMezcladas.map(opcion => `
    <button class="option-button ${respuestas[pregunta.id] === opcion ? 'option-selected' : ''}"
      data-action="exam-answer" data-answer="${encodeURIComponent(opcion)}">${escaparHTML(opcion)}</button>`
  ).join('');

  return `<section class="exam-top">
      <div><span class="eyebrow">SIMULACRO · ${indice + 1} DE ${total}</span>
        <div class="quiz-progress"><i style="width:${Math.round(indice / total * 100)}%"></i></div>
      </div>
      <div class="exam-timer" aria-live="polite">⏱ ${formatearTiempo(segundosRestantes)}</div>
    </section>
    <article class="quiz-card" style="--topic:${pregunta.tema.color}">
      <div class="card-meta"><span class="topic-pill">${escaparHTML(pregunta.tema.nombre)}</span><span>${nivelesDificultad[pregunta.dificultad] || nivelesDificultad.intermedia}</span></div>
      <h2>${escaparHTML(pregunta.enunciado)}</h2><div class="answer-options">${opciones}</div>
      <div class="exam-controls">
        <button class="button button-secondary" data-action="exam-back" ${indice === 0 ? 'disabled' : ''}>← Anterior</button>
        <span>${Object.keys(respuestas).length} de ${total} respondidas</span>${botonSiguiente}
      </div>
    </article>
    <p class="keyboard-hint">El simulacro no muestra respuestas ni modifica tu repetición espaciada.</p>`;
}

export function renderResultadoSimulacro(resultado) {
  return `<section class="summary-card">
    <span class="eyebrow">RESULTADO DEL SIMULACRO</span>
    <h2>${resultado.aciertos} de ${resultado.total} respuestas correctas</h2>
    <p>Este resultado no modifica tus repasos programados.</p>
    <div class="exam-results">${resultado.temas.map(tema => `<div><span>${tema.nombre}</span><b>${tema.aciertos}/${tema.total}</b></div>`).join('')}</div>
    <a class="button button-dark" href="#inicio">Volver al inicio →</a></section>
    <section class="exam-review"><div class="section-heading"><div><span class="eyebrow">REVISIÓN FINAL</span><h3>Respuestas del simulacro</h3></div></div>
      ${resultado.revision.map((item, indice) => `<article class="panel exam-review-item ${item.acierto ? 'exam-review-correct' : 'exam-review-incorrect'}">
        <span class="eyebrow">PREGUNTA ${indice + 1} · ${escaparHTML(item.tema)}</span>
        <h4>${escaparHTML(item.enunciado)}</h4>
        <p>Tu respuesta: <b>${escaparHTML(item.respuesta)}</b></p>
        ${item.acierto ? '' : `<p>Respuesta correcta: <b>${escaparHTML(item.correcta)}</b></p>`}
        <small>${escaparHTML(item.explicacion)}</small>
      </article>`).join('')}
    </section>`;
}

function formatearTiempo(segundos) {
  const minutos = Math.floor(segundos / 60);
  const resto = Math.max(0, segundos % 60);
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

export function renderSettings(progreso) {
  const opciones = [4, 6, 8, 10, 12].map(cantidad =>
    `<option value="${cantidad}" ${progreso.newPerDay === cantidad ? 'selected' : ''}>${cantidad} preguntas</option>`
  ).join('');
  return `<section class="settings-intro">
      <span class="eyebrow">PERSONALIZA TU RITMO</span>
      <h2>Tu plan, a tu manera.</h2>
      <p>El progreso se guarda localmente en este navegador. Exporta una copia para conservarlo.</p>
    </section>
    <section class="settings-grid">
      <article class="panel settings-card">
        <span class="settings-icon">✳</span><h3>Nuevas preguntas por día</h3>
        <p>Elige cuántas preguntas nuevas presentar por cada lección.</p>
        <label for="new-per-day">Preguntas diarias</label><select id="new-per-day">${opciones}</select>
      </article>
      <article class="panel settings-card">
        <span class="settings-icon">⇧</span><h3>Exportar progreso</h3>
        <p>Descarga tus fechas, calificaciones y preguntas guardadas como un archivo JSON.</p>
        <button class="button button-secondary" data-action="export">Exportar JSON ↓</button>
      </article>
      <article class="panel settings-card">
        <span class="settings-icon">⇩</span><h3>Importar progreso</h3>
        <p>Restaura un respaldo de CertiRecall. El archivo se valida antes de reemplazar los datos actuales.</p>
        <label class="button button-secondary file-button">Elegir archivo JSON<input id="import-file" type="file" accept="application/json,.json" hidden></label>
      </article>
      <article class="panel settings-card danger-card">
        <span class="settings-icon">↺</span><h3>Reiniciar progreso</h3>
        <p>Elimina las calificaciones y la actividad guardadas en este navegador.</p>
        <button class="button button-danger" data-action="reset">Reiniciar progreso</button>
      </article>
    </section>
    <section class="panel date-settings">
      <div><span class="eyebrow">MODO DEMOSTRACIÓN</span><h3>Fecha de estudio simulada</h3><p>Avanza para mostrar cuándo aparecen los repasos programados.</p></div>
      <div class="date-actions">
        <button class="button button-secondary" data-action="advance-day">Avanzar al día siguiente →</button>
        <button class="text-button" data-action="reset-date">Volver a hoy</button>
      </div>
    </section>`;
}

export function setActiveNav(vista) {
  document.querySelectorAll('[data-view]').forEach(enlace => {
    enlace.classList.toggle('active', enlace.dataset.view === vista);
  });
}

export function setTitle(titulo) {
  document.querySelector('#page-title').textContent = titulo;
}

export function abrirConfirmacion(titulo, texto, confirmar) {
  const dialogo = document.querySelector('#confirm-dialog');
  document.querySelector('#dialog-content').innerHTML =
    `<span class="eyebrow">CONFIRMAR ACCIÓN</span><h2>${titulo}</h2><p>${texto}</p>`;
  dialogo.showModal();
  document.querySelector('#dialog-confirm').onclick = evento => {
    evento.preventDefault();
    dialogo.close();
    confirmar();
  };
}
