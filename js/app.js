import { cargarDatos } from './data.js';
import {
  cargarProgreso,
  guardarProgreso,
  descargarProgreso,
  importarProgreso,
  reiniciarProgreso
} from './storage.js';
import { calificarPregunta, desplazarFecha } from './scheduler.js';
import {
  crearCola,
  crearColaDificil,
  crearColaExamen
} from './quiz.js';
import { renderReporte } from './report.js';
import {
  abrirConfirmacion,
  mostrarToast,
  renderGlosario,
  renderHome,
  renderLesson,
  renderQuiz,
  renderResultadoSimulacro,
  renderSettings,
  renderSimulacro,
  renderSummary,
  setActiveNav,
  setTitle
} from './ui.js';

const contenedor = document.querySelector('#app');
let datos;
let progreso = cargarProgreso();
let diaLeccion = 1;
let sesion = null;
let simulacro = null;
let fuenteReporte = 'demo';
let consultaGlosario = '';
let temporizadorSimulacro;

const nombresVistas = {
  inicio: 'Tu espacio de estudio',
  estudiar: 'Lección del día',
  quiz: 'Cuestionario',
  reporte: 'Tu reporte',
  ajustes: 'Ajustes',
  glosario: 'Glosario',
  simulacro: 'Simulacro de examen'
};

function guardar() {
  guardarProgreso(progreso);
}

function fechaBonita(fecha) {
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${fecha}T12:00:00`));
}

function diaActual() {
  // El día guardado evita retroceder el plan al restablecer la fecha simulada.
  const diferencia = Math.floor(
    (new Date(`${progreso.simulatedDate}T12:00:00`)
      - new Date(`${progreso.fechaInicio || progreso.simulatedDate}T12:00:00`))
    / 86400000
  );
  const calculado = Math.max(1, diferencia + 1);
  const guardado = progreso.currentDay || calculado;
  return Math.min(datos.temario.dias.length, Math.max(calculado, guardado));
}

function actualizarFecha() {
  document.querySelector('#date-label').textContent = fechaBonita(progreso.simulatedDate);
}

function rachaActual() {
  const fechas = [...new Set(progreso.activity.map(item => item.fecha))].sort().reverse();
  if (!fechas.length) return 0;

  let racha = 0;
  let cursor = progreso.simulatedDate;
  for (const fecha of fechas) {
    if (fecha === cursor) {
      racha += 1;
      cursor = desplazarFecha(cursor, -1);
    } else if (fecha < cursor) {
      break;
    }
  }
  return racha;
}

function render() {
  const vista = location.hash.slice(1).split('?')[0] || 'inicio';
  setActiveNav(vista);
  actualizarFecha();
  setTitle(nombresVistas[vista] || nombresVistas.inicio);

  if (vista === 'inicio') renderInicio();
  else if (vista === 'estudiar') renderLeccion();
  else if (vista === 'quiz') renderCuestionario();
  else if (vista === 'reporte') renderReporteVista();
  else if (vista === 'ajustes') renderAjustes();
  else if (vista === 'glosario') renderGlosarioVista();
  else if (vista === 'simulacro') renderSimulacroVista();
  else location.hash = '#inicio';
}

function renderInicio() {
  const dia = diaActual();
  const pendientes = crearCola(
    datos.temario,
    progreso,
    dia,
    progreso.newPerDay
  ).length;
  contenedor.innerHTML = renderHome({
    temario: datos.temario,
    progreso,
    dia,
    racha: rachaActual(),
    pendientes
  });
}

function renderLeccion() {
  const parametros = new URLSearchParams(location.hash.split('?')[1] || '');
  if (parametros.has('dia')) {
    diaLeccion = Number(parametros.get('dia'));
  }
  diaLeccion = Math.min(diaActual(), Math.max(1, diaLeccion));
  const leccion = datos.temario.dias[diaLeccion - 1];
  contenedor.innerHTML = renderLesson(
    leccion,
    datos.temario.dias.length,
    progreso.completedLessons,
    datos.temario.dias,
    diaActual()
  );
}

function crearSesion(tipo = 'normal') {
  const cola = tipo === 'dificiles'
    ? crearColaDificil(datos.temario, progreso)
    : crearCola(datos.temario, progreso, diaActual(), progreso.newPerDay);
  return {
    tipo,
    cola,
    indice: 0,
    ratings: { otra_vez: 0, dificil: 0, bien: 0, facil: 0 },
    aciertos: 0,
    totalRespondidas: 0,
    reencoladas: new Set(),
    temas: [],
    inicio: Date.now(),
    proxima: ''
  };
}

function renderCuestionario() {
  if (!sesion) {
    const parametros = new URLSearchParams(location.hash.split('?')[1] || '');
    sesion = crearSesion(parametros.get('modo') === 'dificiles' ? 'dificiles' : 'normal');
  }

  if (sesion.cola.length === 0) {
    contenedor.innerHTML = renderQuiz(null, 0, 0, progreso, false);
    return;
  }

  if (sesion.indice >= sesion.cola.length) {
    contenedor.innerHTML = renderSummary({
      aciertos: sesion.aciertos,
      total: sesion.totalRespondidas,
      ratings: sesion.ratings,
      temas: [...new Set(sesion.temas)],
      proxima: sesion.proxima ? fechaBonita(sesion.proxima) : ''
    });
    sesion = null;
    return;
  }

  const pregunta = sesion.cola[sesion.indice];
  contenedor.innerHTML = renderQuiz(
    pregunta,
    sesion.indice,
    sesion.cola.length,
    progreso,
    progreso.starred.includes(pregunta.id)
  );
}

function renderReporteVista() {
  const demo = fuenteReporte === 'demo';
  const registros = demo
    ? datos.historialDemo
    : progreso.activity.map(item => ({ ...item, tiempoSeg: item.tiempoSeg || 0 }));
  contenedor.innerHTML = `
    <div class="report-toolbar">
      <div><span class="eyebrow">APRENDE DE TU PROGRESO</span><h2>Tu esfuerzo, en perspectiva.</h2></div>
      <label class="select-wrap">Ver datos
        <select id="report-source">
          <option value="demo" ${demo ? 'selected' : ''}>Datos de demostración</option>
          <option value="mine" ${!demo ? 'selected' : ''}>Mis datos</option>
        </select>
      </label>
    </div>
    ${renderReporte({ registros, temario: datos.temario, demo })}`;
  document.querySelector('#report-source').onchange = evento => {
    fuenteReporte = evento.target.value;
    renderReporteVista();
  };
}

function renderAjustes() {
  contenedor.innerHTML = renderSettings(progreso);
  document.querySelector('#new-per-day').onchange = evento => {
    progreso.newPerDay = Number(evento.target.value);
    guardar();
    mostrarToast('Preferencia guardada.');
  };
  document.querySelector('#import-file').onchange = importarArchivo;
}

async function importarArchivo(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  try {
    progreso = await importarProgreso(archivo);
    guardar();
    sesion = null;
    mostrarToast('Progreso importado correctamente.');
    render();
  } catch (error) {
    mostrarToast(error.message, 'error');
  }
  evento.target.value = '';
}

function renderGlosarioVista() {
  contenedor.innerHTML = renderGlosario(datos.temario, consultaGlosario);
  document.querySelector('#glossary-search').addEventListener('input', evento => {
    consultaGlosario = evento.target.value;
    actualizarResultadosGlosario();
  });
}

function actualizarResultadosGlosario() {
  const temporal = document.createElement('div');
  temporal.innerHTML = renderGlosario(datos.temario, consultaGlosario);
  document.querySelector('#glossary-results').replaceWith(
    temporal.querySelector('#glossary-results')
  );
}

function iniciarSimulacro() {
  const preguntas = crearColaExamen(datos.temario, diaActual(), 20);
  simulacro = {
    preguntas,
    indice: 0,
    respuestas: {},
    limite: 20 * 60,
    fin: Date.now() + 20 * 60 * 1000,
    resultado: null
  };
  iniciarTemporizadorSimulacro();
}

function iniciarTemporizadorSimulacro() {
  clearInterval(temporizadorSimulacro);
  temporizadorSimulacro = setInterval(() => {
    if (!simulacro || simulacro.resultado) {
      clearInterval(temporizadorSimulacro);
      return;
    }
    if (Date.now() >= simulacro.fin) {
      terminarSimulacro();
      return;
    }
    const contador = document.querySelector('.exam-timer');
    if (contador) {
      const restantes = Math.ceil((simulacro.fin - Date.now()) / 1000);
      contador.textContent = `⏱ ${formatearTiempo(restantes)}`;
    }
  }, 500);
}

function formatearTiempo(segundos) {
  const minutos = Math.floor(segundos / 60);
  return `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}

function renderSimulacroVista() {
  if (!simulacro) iniciarSimulacro();
  if (simulacro.resultado) {
    contenedor.innerHTML = renderResultadoSimulacro(simulacro.resultado);
    return;
  }

  const pregunta = simulacro.preguntas[simulacro.indice];
  const segundos = Math.max(0, Math.ceil((simulacro.fin - Date.now()) / 1000));
  contenedor.innerHTML = renderSimulacro(
    pregunta,
    simulacro.indice,
    simulacro.preguntas.length,
    simulacro.respuestas,
    segundos
  );
}

function terminarSimulacro() {
  if (!simulacro || simulacro.resultado) return;
  clearInterval(temporizadorSimulacro);
  const grupos = new Map();
  let aciertos = 0;

  simulacro.preguntas.forEach(pregunta => {
    const correcto = simulacro.respuestas[pregunta.id] === pregunta.respuestaCorrecta;
    if (correcto) aciertos += 1;
    const grupo = grupos.get(pregunta.tema.id) || {
      nombre: pregunta.tema.nombre,
      aciertos: 0,
      total: 0
    };
    grupo.total += 1;
    if (correcto) grupo.aciertos += 1;
    grupos.set(pregunta.tema.id, grupo);
  });

  simulacro.resultado = {
    aciertos,
    total: simulacro.preguntas.length,
    temas: [...grupos.values()],
    revision: simulacro.preguntas.map(pregunta => ({
      enunciado: pregunta.enunciado,
      tema: pregunta.tema.nombre,
      respuesta: simulacro.respuestas[pregunta.id] || 'Sin respuesta',
      correcta: pregunta.respuestaCorrecta,
      explicacion: pregunta.explicacion,
      acierto: simulacro.respuestas[pregunta.id] === pregunta.respuestaCorrecta
    }))
  };
  // El simulacro informa resultados, pero no toca el progreso de repetición.
  if (location.hash.split('?')[0] === '#simulacro') renderSimulacroVista();
}

function avanzarDia() {
  progreso.simulatedDate = desplazarFecha(progreso.simulatedDate, 1);
  progreso.fechaInicio ||= progreso.simulatedDate;
  progreso.currentDay = Math.min(
    datos.temario.dias.length,
    Math.max(progreso.currentDay || 1, diaActual())
  );
  guardar();
  sesion = null;
  mostrarToast(`Fecha simulada: ${fechaBonita(progreso.simulatedDate)}`);
  render();
}

function iniciarCuestionario() {
  progreso.completedLessons = [
    ...new Set([...progreso.completedLessons, diaLeccion])
  ];
  guardar();
  sesion = null;
  location.hash = '#quiz';
}

function responder(opcionCodificada) {
  const pregunta = sesion.cola[sesion.indice];
  if (pregunta.answered) return;

  const opcion = decodeURIComponent(opcionCodificada);
  pregunta.seleccionada = opcion;
  pregunta.correct = opcion === pregunta.respuestaCorrecta;
  pregunta.answered = true;
  if (pregunta.correct) sesion.aciertos += 1;
  renderCuestionario();
}

function guardarRespuesta() {
  const pregunta = sesion.cola[sesion.indice];
  const calificacion = this.dataset.rating;
  const segundos = Math.max(1, Math.round((Date.now() - sesion.inicio) / 1000));
  const resultado = calificarPregunta(progreso, pregunta.id, calificacion);
  progreso.activity.push({
    fecha: progreso.simulatedDate,
    preguntaId: pregunta.id,
    temaId: pregunta.tema.id,
    calificacion,
    acierto: pregunta.tipo === 'flashcard'
      ? calificacion !== 'otra_vez'
      : Boolean(pregunta.correct),
    tiempoSeg: segundos
  });

  sesion.ratings[calificacion] += 1;
  sesion.totalRespondidas += 1;
  sesion.temas.push(pregunta.tema.id);
  if (!sesion.proxima || resultado.proximaFecha < sesion.proxima) {
    sesion.proxima = resultado.proximaFecha;
  }
  reencolarSiHaceFalta(pregunta, calificacion);
  guardar();
  sesion.inicio = Date.now();
  sesion.indice += 1;
  renderCuestionario();
}

function reencolarSiHaceFalta(pregunta, calificacion) {
  if (calificacion !== 'otra_vez' || sesion.reencoladas.has(pregunta.id)) return;
  sesion.reencoladas.add(pregunta.id);
  sesion.cola.push({
    ...pregunta,
    answered: false,
    correct: false,
    seleccionada: undefined,
    revealed: false
  });
}

function abrirPreguntaFallada(id) {
  const dia = datos.temario.dias.find(item =>
    item.preguntas.some(pregunta => pregunta.id === id)
  );
  const pregunta = dia?.preguntas.find(item => item.id === id);
  if (!dia || !pregunta) return;

  sesion = {
    ...crearSesion('dificiles'),
    cola: [{
      ...pregunta,
      dia: dia.dia,
      tema: dia.tema,
      clase: 'repaso',
      opcionesMezcladas: pregunta.opciones ? mezclar([...pregunta.opciones]) : undefined
    }]
  };
  location.hash = '#quiz?modo=dificiles';
  renderCuestionario();
}

function mezclar(opciones) {
  for (let indice = opciones.length - 1; indice > 0; indice -= 1) {
    const aleatorio = Math.floor(Math.random() * (indice + 1));
    [opciones[indice], opciones[aleatorio]] = [opciones[aleatorio], opciones[indice]];
  }
  return opciones;
}

contenedor.addEventListener('click', evento => {
  const enlaceFallado = evento.target.closest('[data-review-question]');
  if (enlaceFallado) {
    evento.preventDefault();
    abrirPreguntaFallada(enlaceFallado.dataset.reviewQuestion);
    return;
  }

  const boton = evento.target.closest('[data-action]');
  if (!boton) return;

  const accion = boton.dataset.action;
  if (accion === 'start-quiz') iniciarCuestionario();
  if (accion === 'select-day') {
    diaLeccion = Number(boton.dataset.day);
    render();
  }
  if (accion === 'answer' && sesion) responder(boton.dataset.answer);
  if (accion === 'reveal' && sesion) {
    sesion.cola[sesion.indice].revealed = true;
    renderCuestionario();
  }
  if (accion === 'star' && sesion) alternarFavorita();
  if (accion === 'rate' && sesion) guardarRespuesta.call(boton);
  if (accion === 'advance-day') avanzarDia();
  if (accion === 'export') descargarProgreso(progreso);
  if (accion === 'reset') confirmarReinicio();
  if (accion === 'reset-date') volverAHoy();
  if (accion === 'copy-code') copiarCodigo(boton);
  if (accion === 'exam-answer') guardarRespuestaSimulacro(boton.dataset.answer);
  if (accion === 'exam-next') cambiarPreguntaSimulacro(1);
  if (accion === 'exam-back') cambiarPreguntaSimulacro(-1);
  if (accion === 'exam-finish') terminarSimulacro();
});

function alternarFavorita() {
  const id = sesion.cola[sesion.indice].id;
  progreso.starred = progreso.starred.includes(id)
    ? progreso.starred.filter(item => item !== id)
    : [...progreso.starred, id];
  guardar();
  renderCuestionario();
}

function confirmarReinicio() {
  abrirConfirmacion(
    '¿Reiniciar tu progreso?',
    'Se eliminarán las tarjetas programadas, la actividad y las preguntas guardadas.',
    () => {
      progreso = reiniciarProgreso();
      progreso.fechaInicio = progreso.simulatedDate;
      progreso.currentDay = 1;
      sesion = null;
      guardar();
      render();
      mostrarToast('Progreso reiniciado.');
    }
  );
}

function volverAHoy() {
  progreso.simulatedDate = new Date().toISOString().slice(0, 10);
  progreso.fechaInicio ||= progreso.simulatedDate;
  progreso.currentDay = Math.max(progreso.currentDay || 1, diaActual());
  sesion = null;
  guardar();
  render();
  mostrarToast('Volviste a la fecha de hoy; tu día del plan se conserva.');
}

async function copiarCodigo(boton) {
  const codigo = boton.closest('.code-example').querySelector('.code-source').value;
  try {
    await navigator.clipboard.writeText(codigo);
    mostrarToast('Código copiado.');
  } catch (error) {
    mostrarToast('No se pudo copiar. Selecciona el código y cópialo manualmente.', 'error');
    console.error('Error al copiar código:', error);
  }
}

function guardarRespuestaSimulacro(opcionCodificada) {
  const pregunta = simulacro.preguntas[simulacro.indice];
  simulacro.respuestas[pregunta.id] = decodeURIComponent(opcionCodificada);
  renderSimulacroVista();
}

function cambiarPreguntaSimulacro(cambio) {
  simulacro.indice = Math.min(
    simulacro.preguntas.length - 1,
    Math.max(0, simulacro.indice + cambio)
  );
  renderSimulacroVista();
}

document.querySelector('#date-control').addEventListener('click', avanzarDia);
document.querySelector('#confirm-dialog').addEventListener('click', evento => {
  if (evento.target === evento.currentTarget) evento.currentTarget.close();
});

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#estudiar')) {
    const parametros = new URLSearchParams(location.hash.split('?')[1] || '');
    if (parametros.has('dia')) diaLeccion = Number(parametros.get('dia'));
  }
  if (location.hash.split('?')[0] !== '#quiz') sesion = null;
  render();
});

document.addEventListener('keydown', evento => {
  if (location.hash.split('?')[0] !== '#quiz' || !sesion) return;
  if (['1', '2', '3', '4'].includes(evento.key)) {
    const calificacion = ['otra_vez', 'dificil', 'bien', 'facil'][Number(evento.key) - 1];
    document.querySelector(`[data-action="rate"][data-rating="${calificacion}"]`)?.click();
  }
  const pregunta = sesion.cola[sesion.indice];
  if (evento.code === 'Space' && pregunta?.tipo === 'flashcard' && !pregunta.revealed) {
    evento.preventDefault();
    document.querySelector('[data-action="reveal"]')?.click();
  }
});

try {
  datos = await cargarDatos();
  if (!progreso.fechaInicio) progreso.fechaInicio = progreso.simulatedDate;
  if (!progreso.currentDay) progreso.currentDay = 1;
  guardar();
  render();
} catch (error) {
  contenedor.innerHTML = `<section class="error-state"><span>!</span><h2>No pudimos cargar CertiRecall</h2><p>${error.message}</p></section>`;
  console.error(error);
}
