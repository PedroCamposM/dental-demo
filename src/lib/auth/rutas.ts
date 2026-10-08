// Rutas que se pueden ver sin iniciar sesión. Todo lo demás exige sesión.
const RUTAS_PUBLICAS = ["/login"];

export function esRutaPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((r) => ruta === r || ruta.startsWith(`${r}/`));
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
