import { esVencida } from './scheduler.js';

export function crearCola(temario, progreso, dia, cantidadNuevas = 6) {
  const mapa = new Map(temario.dias.flatMap(diaActual =>
    diaActual.preguntas.map(pregunta => [
      pregunta.id,
      { ...pregunta, dia: diaActual.dia, tema: diaActual.tema }
    ])
  ));
  // El cupo es diario: descuenta las preguntas que ya se vieron por primera vez hoy.
  const introducidasHoy = Object.values(progreso.schedules)
    .filter(registro => registro.historial?.[0]?.fecha === progreso.simulatedDate)
    .length;
  const cupo = Math.max(0, cantidadNuevas - introducidasHoy);
  // Primero las del día actual y luego las pendientes de días anteriores.
  const diasDisponibles = temario.dias
    .filter(item => item.dia <= dia)
    .sort((a, b) => (b.dia === dia) - (a.dia === dia) || a.dia - b.dia);
  const preguntasNuevas = diasDisponibles
    .flatMap(item => item.preguntas
      .filter(pregunta => !progreso.schedules[pregunta.id])
      .map(pregunta => ({ ...pregunta, dia: item.dia, tema: item.tema, clase: 'nueva' })))
    .slice(0, cupo);
  const repasos = Object.entries(progreso.schedules)
    .filter(([, registro]) => esVencida(registro, progreso.simulatedDate))
    .map(([id]) => mapa.get(id))
    .filter(Boolean)
    .map(pregunta => ({ ...pregunta, clase: 'repaso' }));
  const unicas = new Map([...preguntasNuevas, ...repasos].map(pregunta => [
    pregunta.id,
    prepararPregunta(pregunta)
  ]));

  return mezclar([...unicas.values()]);
}

export function crearColaDificil(temario, progreso) {
  const ids = new Set(progreso.starred);
  Object.entries(progreso.schedules).forEach(([id, registro]) => {
    if (registro.historial?.some(item => ['dificil', 'otra_vez'].includes(item.calificacion))) {
      ids.add(id);
    }
  });
  return obtenerPreguntas(temario, ids);
}

export function crearColaExamen(temario, diaDesbloqueado, cantidad = 20) {
  const disponibles = temario.dias
    .filter(dia => dia.dia <= diaDesbloqueado)
    .flatMap(dia => dia.preguntas.map(pregunta => {
      if (pregunta.tipo === 'opcion_multiple') {
        return prepararPregunta({
          ...pregunta,
          dia: dia.dia,
          tema: dia.tema,
          clase: 'simulacro'
        });
      }

      const opciones = [...new Set([
        pregunta.respuestaCorrecta,
        ...dia.preguntas
          .filter(item => item.tipo === 'flashcard' && item.id !== pregunta.id)
          .map(item => item.respuestaCorrecta)
      ])];
      return prepararPregunta({
        ...pregunta,
        tipo: 'opcion_multiple',
        opciones,
        opcionesMezcladas: mezclar([...opciones]),
        dia: dia.dia,
        tema: dia.tema,
        clase: 'simulacro'
      });
    }));

  return mezclar(disponibles)
    .slice(0, Math.min(cantidad, disponibles.length));
}

function obtenerPreguntas(temario, ids) {
  return mezclar(temario.dias.flatMap(dia =>
    dia.preguntas
      .filter(pregunta => ids.has(pregunta.id))
      .map(pregunta => prepararPregunta({
        ...pregunta,
        dia: dia.dia,
        tema: dia.tema,
        clase: 'repaso'
      }))
  ));
}

function prepararPregunta(pregunta) {
  if (pregunta.tipo !== 'opcion_multiple') return pregunta;
  // El orden queda guardado en el objeto de sesión entre renderizados.
  return { ...pregunta, opcionesMezcladas: mezclar([...pregunta.opciones]) };
}

export function prepararPreguntaSuelta(pregunta, dia, clase) {
  return prepararPregunta({ ...pregunta, dia: dia.dia, tema: dia.tema, clase });
}

function mezclar(lista) {
  for (let indice = lista.length - 1; indice > 0; indice--) {
    const aleatorio = Math.floor(Math.random() * (indice + 1));
    [lista[indice], lista[aleatorio]] = [lista[aleatorio], lista[indice]];
  }
  return lista;
}
