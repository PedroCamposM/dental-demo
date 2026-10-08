// Fechas de la clínica en America/Lima. Perú no tiene horario de verano desde
// 1994, así que el desfase es siempre -05:00.
const ZONA = "America/Lima";
const DESFASE = "-05:00";

const formatoFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha calendario en Lima (YYYY-MM-DD) de un instante. */
export function fechaLima(instante: Date | string): string {
  return formatoFecha.format(new Date(instante));
}

/** Primer instante del mes en curso en Lima. */
export function inicioMesLima(ahora: Date): Date {
  return new Date(`${fechaLima(ahora).slice(0, 7)}-01T00:00:00${DESFASE}`);
}

/** Días calendario de `desde` a `hasta` (ambos YYYY-MM-DD). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

const formatoCorto = new Intl.DateTimeFormat("es-PE", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "2026-10-08" -> "8 oct 2026" */
export function formatearFecha(fecha: string): string {
  return formatoCorto.format(new Date(`${fecha}T00:00:00Z`)).replace(".", "");
}

/** «hoy», «hace 1 día», «hace N días». */
export function hace(dias: number): string {
  return dias <= 0 ? "hoy" : dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}
