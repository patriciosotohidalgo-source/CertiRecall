// Fechas como texto AAAA-MM-DD; se usa el mediodía para evitar saltos por zona horaria.

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(fecha: string, dias: number): string {
  const resultado = new Date(`${fecha}T12:00:00`);
  resultado.setDate(resultado.getDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

export function daysBetween(desde: string, hasta: string): number {
  return Math.round(
    (new Date(`${hasta}T12:00:00`).getTime() - new Date(`${desde}T12:00:00`).getTime()) / 86400000
  );
}

export function formatDate(fecha: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${fecha}T12:00:00`));
}
