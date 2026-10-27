// Valida el temario: estructura, respuestas, y que todos los idiomas tengan los mismos IDs.
// Uso: npm run check:content
import { readdirSync, readFileSync } from 'node:fs';

const leer = ruta => JSON.parse(readFileSync(new URL(`../public/content/${ruta}`, import.meta.url), 'utf8'));
const errores = [];
const idiomas = readdirSync(new URL('../public/content/', import.meta.url), { withFileTypes: true })
  .filter(entrada => entrada.isDirectory()).map(entrada => entrada.name);

const idsPorIdioma = {};
for (const idioma of idiomas) {
  const temario = leer(`${idioma}/temario.json`);
  const ids = [];
  for (const dia of temario.dias) {
    for (const p of dia.preguntas) {
      ids.push(p.id);
      if (p.temaId !== dia.tema.id) errores.push(`${idioma}/${p.id}: temaId no coincide con el día`);
      if (p.tipo === 'opcion_multiple') {
        if (p.opciones?.length !== 4) errores.push(`${idioma}/${p.id}: debe tener 4 opciones`);
        if (!p.opciones?.includes(p.respuestaCorrecta)) errores.push(`${idioma}/${p.id}: la respuesta no está entre las opciones`);
        if (new Set(p.opciones).size !== p.opciones?.length) errores.push(`${idioma}/${p.id}: opciones repetidas`);
      }
    }
  }
  if (new Set(ids).size !== ids.length) errores.push(`${idioma}: IDs de pregunta repetidos`);
  idsPorIdioma[idioma] = ids;
}

const base = idsPorIdioma.es;
for (const [idioma, ids] of Object.entries(idsPorIdioma)) {
  if (JSON.stringify(ids) !== JSON.stringify(base)) errores.push(`${idioma}: los IDs no coinciden con es`);
}

const validos = new Set(base);
const faltantes = leer('historial-demo.json').filter(r => !validos.has(r.preguntaId));
if (faltantes.length) errores.push(`historial-demo: ${faltantes.length} registros con preguntas inexistentes`);

if (errores.length) {
  console.error(errores.join('\n'));
  process.exit(1);
}
console.log(`Contenido válido: ${idiomas.join(', ')} · ${base.length} preguntas por idioma.`);
