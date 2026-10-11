// Etapa 19: equipo de la clínica (invitar, desactivar) y contraseñas. Validación pura; la base
// vuelve a validar.

export type RolEquipo = "admin" | "odontologo" | "asistente" | "recepcion";
export const ROLES_EQUIPO: RolEquipo[] = ["odontologo", "asistente", "recepcion", "admin"];

/** Contraseña de 8 a 72 caracteres con letras y números (null si está bien). */
export function errorClave(clave: string): string | null {
  if (clave.length < 8 || clave.length > 72) return "La contraseña tiene de 8 a 72 caracteres.";
  if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave)) return "Usa letras y números.";
  return null;
}

export type CampoInvitacion = "correo" | "nombre" | "rol" | "cop";
export type DatosInvitacion = { correo: string; nombre: string; rol: RolEquipo; cop: string | null };

export function validarInvitacion(t: (c: string) => string):
  { ok: true; datos: DatosInvitacion } | { ok: false; errores: Partial<Record<CampoInvitacion, string>> } {
  const e: Partial<Record<CampoInvitacion, string>> = {};
  const correo = t("correo").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 200) e.correo = "Escribe un correo válido.";
  const nombre = t("nombre").trim();
  if (nombre.length < 3 || nombre.length > 120) e.nombre = "El nombre va de 3 a 120 caracteres.";
  const rol = t("rol") as RolEquipo;
  if (!ROLES_EQUIPO.includes(rol)) e.rol = "Elige el rol.";
  const cop = t("cop").trim();
  if (cop && !/^\d{1,6}$/.test(cop)) e.cop = "El número de colegiatura (COP) tiene de 1 a 6 dígitos.";
  else if (rol === "odontologo" && !cop) e.cop = "El odontólogo necesita su número de colegiatura (COP).";
  if (Object.keys(e).length > 0) return { ok: false, errores: e };
  // Asistente y recepción no registran historia clínica: no llevan COP.
  return { ok: true, datos: { correo, nombre, rol, cop: rol === "asistente" || rol === "recepcion" ? null : cop || null } };
}

/** Si la invitación supera el plan (solo avisa). `max` null: sin límite. */
export function superaPlan(odontologosActuales: number, datos: DatosInvitacion, max: number | null | undefined): boolean {
  const cuenta = (datos.rol === "odontologo" || datos.rol === "admin") && datos.cop !== null;
  return cuenta && typeof max === "number" && odontologosActuales + 1 > max;
}
