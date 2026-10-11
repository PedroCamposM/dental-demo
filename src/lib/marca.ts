// Etapa 15: personalización de la clínica (color, logo y membrete).
//
// El color de la clínica reemplaza al verde azulado (teal) de toda la app: los tonos que se
// usan (50, 100, 200, 600, 700, 800, 900) se derivan del color elegido. Se exige que el
// texto blanco sobre ese color se lea bien (contraste WCAG AA, 4.5:1), porque es el color
// de los botones principales.

const HEX = /^#[0-9a-f]{6}$/;

/** Contraste WCAG entre dos colores #rrggbb. */
export function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Valida y normaliza el color (#RRGGBB → #rrggbb). Vacío: sin color propio. */
export function validarColor(texto: string): { ok: true; color: string | null } | { ok: false; error: string } {
  const t = texto.trim().toLowerCase();
  if (!t) return { ok: true, color: null };
  if (!HEX.test(t)) return { ok: false, error: "Elige el color (formato #RRGGBB)." };
  if (contraste(t, "#ffffff") < 4.5) {
    return { ok: false, error: "Ese color es muy claro: el texto blanco de los botones no se leería bien. Elige uno más oscuro." };
  }
  return { ok: true, color: t };
}

/** CSS que reemplaza los tonos teal de Tailwind por los del color de la clínica. */
export function cssMarca(color: string | null): string | null {
  if (!color || !HEX.test(color)) return null;
  const mezcla = (otro: "white" | "black", pct: number) => `color-mix(in oklab, ${color} ${pct}%, ${otro})`;
  return `:root{--color-teal-50:${mezcla("white", 8)};--color-teal-100:${mezcla("white", 16)};`
    + `--color-teal-200:${mezcla("white", 30)};--color-teal-600:${mezcla("white", 88)};--color-teal-700:${color};`
    + `--color-teal-800:${mezcla("black", 82)};--color-teal-900:${mezcla("black", 65)};}`;
}

export type DatosMembrete = { direccion: string | null; telefono: string | null; correo: string | null; pie_documentos: string | null };

/** Valida los datos del membrete (todos opcionales). */
export function validarMembrete(t: (c: string) => string):
  { ok: true; datos: DatosMembrete } | { ok: false; errores: Partial<Record<keyof DatosMembrete, string>> } {
  const errores: Partial<Record<keyof DatosMembrete, string>> = {};
  const campo = (c: keyof DatosMembrete, max: number) => {
    const v = t(c).trim();
    if (v.length > max) errores[c] = `Máximo ${max} caracteres.`;
    return v || null;
  };
  const datos = {
    direccion: campo("direccion", 200), telefono: campo("telefono", 40), correo: campo("correo", 120),
    pie_documentos: campo("pie_documentos", 300),
  };
  if (datos.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) errores.correo = "Correo inválido.";
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, datos };
}

/** Tipos de imagen aceptados para el logo (sin SVG: puede llevar código). */
export const TIPOS_LOGO = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export const MAX_LOGO_BYTES = 512 * 1024;
