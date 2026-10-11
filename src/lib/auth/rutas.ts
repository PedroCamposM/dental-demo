// Rutas que se pueden ver sin iniciar sesión. Todo lo demás exige sesión.
// Las de ingreso (login y registro a la prueba) mandan al inicio a quien ya tiene sesión;
// las abiertas (confirmar el correo, términos) se ven con o sin sesión. La tarea diaria
// (/api/cron) no tiene sesión: la protege su propia clave (CRON_SECRET).
const RUTAS_DE_INGRESO = ["/login", "/registro"];
const RUTAS_ABIERTAS = ["/auth/confirmar", "/terminos", "/api/cron"];

const coincide = (ruta: string, r: string) => ruta === r || ruta.startsWith(`${r}/`);

export function esRutaPublica(ruta: string): boolean {
  return [...RUTAS_DE_INGRESO, ...RUTAS_ABIERTAS].some((r) => coincide(ruta, r));
}

/** Login y registro: con sesión no tienen sentido y se vuelve al inicio. */
export function esRutaDeIngreso(ruta: string): boolean {
  return RUTAS_DE_INGRESO.some((r) => coincide(ruta, r));
}

/**
 * Adónde volver después del login. Solo rutas internas: evita que un enlace
 * como /login?next=https://otro-sitio lleve al usuario fuera de la app.
 */
export function destinoSeguro(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return esRutaPublica(next.split(/[?#]/)[0] ?? "") ? "/" : next;
}
