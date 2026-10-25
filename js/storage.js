const CLAVE = 'certirecall-progreso-v1';
const fechaHoy = () => new Date().toISOString().slice(0, 10);
export function progresoInicial() {
  return { version: 1, simulatedDate: fechaHoy(), newPerDay: 6, schedules: {}, activity: [], starred: [], completedLessons: [], lastStudyDate: null };
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
export function guardarProgreso(progreso) { localStorage.setItem(CLAVE, JSON.stringify(progreso)); }
export function validarProgreso(d) {
  const calificaciones = ['otra_vez', 'dificil', 'bien', 'facil'];
  const fechaValida = valor => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(`${valor}T12:00:00`));
  const registroValido = r => r && typeof r === 'object' && Number.isFinite(r.intervalo) && Number.isFinite(r.facilidad) && Number.isInteger(r.repeticiones) && fechaValida(r.proximaFecha) && Array.isArray(r.historial) && r.historial.every(h => fechaValida(h.fecha) && calificaciones.includes(h.calificacion));
  const actividadValida = a => a && typeof a === 'object' && fechaValida(a.fecha) && typeof a.preguntaId === 'string' && typeof a.temaId === 'string' && calificaciones.includes(a.calificacion) && typeof a.acierto === 'boolean' && Number.isFinite(a.tiempoSeg);
  return Boolean(d && typeof d === 'object' && d.version === 1 && fechaValida(d.simulatedDate) && d.schedules && typeof d.schedules === 'object' && Object.values(d.schedules).every(registroValido) && Array.isArray(d.activity) && d.activity.every(actividadValida) && Array.isArray(d.starred) && d.starred.every(x => typeof x === 'string') && Array.isArray(d.completedLessons) && d.completedLessons.every(Number.isInteger) && Number.isInteger(d.newPerDay) && d.newPerDay >= 1 && d.newPerDay <= 60);
}
export function descargarProgreso(progreso) {
  const blob = new Blob([JSON.stringify(progreso, null, 2)], { type: 'application/json' });
  const enlace = document.createElement('a'); enlace.href = URL.createObjectURL(blob); enlace.download = 'certirecall-progreso.json'; enlace.click(); URL.revokeObjectURL(enlace.href);
}
export async function importarProgreso(archivo) {
  const datos = JSON.parse(await archivo.text());
  if (!validarProgreso(datos)) throw new Error('El archivo no tiene una estructura de progreso válida de CertiRecall.');
  return datos;
}
export function reiniciarProgreso() { localStorage.removeItem(CLAVE); return progresoInicial(); }
