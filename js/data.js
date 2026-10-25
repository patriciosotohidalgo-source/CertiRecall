// Carga los archivos de contenido y comunica errores de ejecución con claridad.
export async function cargarJSON(ruta) {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${ruta} (${respuesta.status}).`);
  return respuesta.json();
}
export async function cargarDatos() {
  try {
    const [temario, historialDemo] = await Promise.all([
      cargarJSON('./data/temario.json'), cargarJSON('./data/historial-demo.json')
    ]);
    return { temario, historialDemo };
  } catch (error) {
    const esFile = location.protocol === 'file:';
    const ayuda = esFile ? ' Abre el proyecto con Live Server de VS Code o publícalo en GitHub Pages; fetch no puede leer los JSON desde file://.' : ' Comprueba que los archivos JSON estén disponibles.';
    throw new Error(`${error.message}${ayuda}`);
  }
}
