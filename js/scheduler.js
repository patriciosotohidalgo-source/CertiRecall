// Repetición espaciada: versión simplificada del algoritmo SM-2 (base de Anki).
// Cada pregunta guarda: intervalo (días), facilidad (factor de crecimiento),
// repeticiones seguidas sin fallar, próxima fecha de repaso e historial.

const FACILIDAD_INICIAL = 2.5;
const FACILIDAD_MINIMA = 1.3;

function sumarDias(fecha, dias) {
  const resultado = new Date(`${fecha}T12:00:00`);
  resultado.setDate(resultado.getDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

// Días hasta el próximo repaso según la calificación (se muestra en cada botón).
export function intervaloEstimado(registro = {}, calificacion) {
  const repeticiones = registro.repeticiones || 0;
  const intervalo = registro.intervalo || 0;
  const facilidad = registro.facilidad || FACILIDAD_INICIAL;

  // Otra vez: se olvidó; vuelve mañana (y además se repite en la sesión actual).
  if (calificacion === 'otra_vez') return 1;

  // Difícil: el intervalo crece poco (×1,2).
  if (calificacion === 'dificil') return Math.max(1, Math.round((intervalo || 1) * 1.2));

  // Bien: 1 día la primera vez, 3 días la segunda y luego intervalo × facilidad.
  let dias;
  if (repeticiones === 0) dias = 1;
  else if (repeticiones === 1) dias = 3;
  else dias = Math.max(1, Math.round((intervalo || 1) * facilidad));

  // Fácil: como Bien, pero un 30 % más largo.
  if (calificacion === 'facil') dias = Math.max(1, Math.round(dias * 1.3));
  return dias;
}

// Actualiza el registro de la pregunta y devuelve cuándo debe repasarse.
export function calificarPregunta(progreso, preguntaId, calificacion) {
  const anterior = progreso.schedules[preguntaId]
    || { intervalo: 0, facilidad: FACILIDAD_INICIAL, repeticiones: 0, historial: [] };
  const registro = { ...anterior, historial: [...(anterior.historial || [])] };
  const dias = intervaloEstimado(registro, calificacion);

  if (calificacion === 'otra_vez') {
    // Un fallo reinicia la racha y hace la pregunta más "difícil".
    registro.intervalo = 1;
    registro.repeticiones = 0;
    registro.facilidad = Math.max(FACILIDAD_MINIMA, registro.facilidad - 0.2);
  } else if (calificacion === 'dificil') {
    registro.intervalo = dias;
    registro.repeticiones += 1;
    registro.facilidad = Math.max(FACILIDAD_MINIMA, registro.facilidad - 0.15);
  } else {
    registro.intervalo = dias;
    registro.repeticiones += 1;
    if (calificacion === 'facil') registro.facilidad += 0.15;
  }

  registro.proximaFecha = sumarDias(progreso.simulatedDate, dias);
  registro.historial.push({ fecha: progreso.simulatedDate, calificacion });
  progreso.schedules[preguntaId] = registro;
  return { dias, proximaFecha: registro.proximaFecha };
}

export function esVencida(registro, fecha) {
  return Boolean(registro?.proximaFecha && registro.proximaFecha <= fecha);
}

export function desplazarFecha(fecha, dias) {
  return sumarDias(fecha, dias);
}
