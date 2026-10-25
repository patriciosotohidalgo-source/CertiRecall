const CLAVE = 'certirecall-progreso-v1';
const CALIFICACIONES = ['otra_vez', 'dificil', 'bien', 'facil'];

const fechaHoy = () => new Date().toISOString().slice(0, 10);

export function progresoInicial() {
  return {
    version: 1,
    simulatedDate: fechaHoy(),
    newPerDay: 12,
    schedules: {},
    activity: [],
    starred: [],
    completedLessons: [],
    lastStudyDate: null
  };
}

export function cargarProgreso() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (!guardado) return progresoInicial();
    const datos = JSON.parse(guardado);
    return validarProgreso(datos) ? { ...progresoInicial(), ...datos } : progresoInicial();
  } catch (error) {
    console.error('No se pudo leer el progreso local:', error);
    return progresoInicial();
  }
}

export function guardarProgreso(progreso) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(progreso));
  } catch (error) {
    // Navegación privada o almacenamiento lleno: la app sigue funcionando en memoria.
    console.error('No se pudo guardar el progreso local:', error);
  }
}

// Formato AAAA-MM-DD y fecha real.
function fechaValida(valor) {
  return typeof valor === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    && !Number.isNaN(Date.parse(`${valor}T12:00:00`));
}

// Registro de repetición espaciada de una pregunta.
function registroValido(registro) {
  return registro && typeof registro === 'object'
    && Number.isFinite(registro.intervalo)
    && Number.isFinite(registro.facilidad)
    && Number.isInteger(registro.repeticiones)
    && fechaValida(registro.proximaFecha)
    && Array.isArray(registro.historial)
    && registro.historial.every(item =>
      fechaValida(item.fecha) && CALIFICACIONES.includes(item.calificacion));
}

// Evento del historial de actividad usado por el reporte.
function actividadValida(actividad) {
  return actividad && typeof actividad === 'object'
    && fechaValida(actividad.fecha)
    && typeof actividad.preguntaId === 'string'
    && typeof actividad.temaId === 'string'
    && CALIFICACIONES.includes(actividad.calificacion)
    && typeof actividad.acierto === 'boolean'
    && Number.isFinite(actividad.tiempoSeg);
}

export function validarProgreso(datos) {
  return Boolean(datos && typeof datos === 'object'
    && datos.version === 1
    && fechaValida(datos.simulatedDate)
    && datos.schedules && typeof datos.schedules === 'object'
    && Object.values(datos.schedules).every(registroValido)
    && Array.isArray(datos.activity) && datos.activity.every(actividadValida)
    && Array.isArray(datos.starred) && datos.starred.every(id => typeof id === 'string')
    && Array.isArray(datos.completedLessons) && datos.completedLessons.every(Number.isInteger)
    && Number.isInteger(datos.newPerDay) && datos.newPerDay >= 1 && datos.newPerDay <= 60);
}

export function descargarProgreso(progreso) {
  const blob = new Blob([JSON.stringify(progreso, null, 2)], { type: 'application/json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'certirecall-progreso.json';
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

export async function importarProgreso(archivo) {
  const datos = JSON.parse(await archivo.text());
  if (!validarProgreso(datos)) {
    throw new Error('El archivo no tiene una estructura de progreso válida de CertiRecall.');
  }
  return datos;
}

export function reiniciarProgreso() {
  try {
    localStorage.removeItem(CLAVE);
  } catch (error) {
    console.error('No se pudo borrar el progreso local:', error);
  }
  return progresoInicial();
}
