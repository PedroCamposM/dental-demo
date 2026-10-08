// Cierre de sesión por inactividad. Lógica pura: la usa el componente del
// navegador, que comparte la última actividad entre pestañas.

/** Cookies (sin datos sensibles) que permiten al middleware cerrar sesiones viejas. */
export const COOKIE_ACTIVIDAD = "dental_ult";
export const COOKIE_LIMITE = "dental_lim";
/** Pantalla bloqueada (httpOnly: solo el servidor la pone y la quita al desbloquear). */
export const COOKIE_BLOQUEO = "dental_bloqueo";
/** Las cookies de actividad duran un día: sobreviven a cerrar el navegador. */
export const DURACION_COOKIE_S = 86_400;

/** Segundos de aviso antes de cerrar la sesión. */
export const SEGUNDOS_AVISO = 60;

export type EstadoInactividad =
  | { tipo: "activa" }
  | { tipo: "aviso"; segundosRestantes: number }
  | { tipo: "expirada" };

/** Estado según la última actividad (ms), el instante actual (ms) y el límite en minutos. */
export function estadoInactividad(ultimaActividad: number, ahora: number, minutos: number): EstadoInactividad {
  const limite = minutos * 60_000;
  const inactivo = Math.max(0, ahora - ultimaActividad);
  if (inactivo >= limite) return { tipo: "expirada" };
  const restante = limite - inactivo;
  if (restante <= SEGUNDOS_AVISO * 1000) return { tipo: "aviso", segundosRestantes: Math.ceil(restante / 1000) };
  return { tipo: "activa" };
}

/** Valida los minutos configurados por la clínica (5 a 120). */
export function minutosValidos(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 5 && n <= 120 ? n : null;
}
