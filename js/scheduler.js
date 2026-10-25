const sumarDias = (fecha, dias) => { const d = new Date(`${fecha}T12:00:00`); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
export function intervaloEstimado(registro = {}, calificacion) {
  const repeticiones = registro.repeticiones || 0;
  const intervalo = registro.intervalo || 0;
  const facilidad = registro.facilidad || 2.5;
  if (calificacion === 'otra_vez') return 1;
  if (calificacion === 'dificil') return Math.max(1, Math.round((intervalo || 1) * 1.2));
  let base = repeticiones === 0 ? 1 : repeticiones === 1 ? 3 : Math.max(1, Math.round((intervalo || 1) * facilidad));
  if (calificacion === 'facil') base = Math.max(1, Math.round(base * 1.3));
  return base;
}
export function calificarPregunta(progreso, preguntaId, calificacion) {
  const anterior = progreso.schedules[preguntaId] || { intervalo: 0, facilidad: 2.5, repeticiones: 0, historial: [] };
  const registro = { ...anterior, historial: [...(anterior.historial || [])] };
  const dias = intervaloEstimado(registro, calificacion);
  if (calificacion === 'otra_vez') { registro.intervalo = 1; registro.facilidad = Math.max(1.3, registro.facilidad - 0.2); registro.repeticiones = 0; }
  else if (calificacion === 'dificil') { registro.intervalo = dias; registro.facilidad = Math.max(1.3, registro.facilidad - 0.15); registro.repeticiones += 1; }
  else { registro.intervalo = dias; registro.repeticiones += 1; if (calificacion === 'facil') registro.facilidad += 0.15; }
  registro.proximaFecha = sumarDias(progreso.simulatedDate, dias);
  registro.historial.push({ fecha: progreso.simulatedDate, calificacion });
  progreso.schedules[preguntaId] = registro;
  return { dias, proximaFecha: registro.proximaFecha };
}
export function esVencida(registro, fecha) { return Boolean(registro?.proximaFecha && registro.proximaFecha <= fecha); }
export function desplazarFecha(fecha, dias) { return sumarDias(fecha, dias); }
