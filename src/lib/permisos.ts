import type { Rol } from "@/lib/sesion";

/** Quiénes ven el Tablero de gestión (presupuestos, tratamientos detenidos, cuotas, controles). */
const ROLES_GESTION: readonly Rol[] = ["admin", "odontologo", "recepcion"];

export function veGestion(rol: Rol): boolean {
  return ROLES_GESTION.includes(rol);
}

/**
 * Primera pantalla de cada usuario: la atención del paciente va primero. Con los
 * módulos de pacientes aún apagados, gestión para quien la ve; si no, ninguna.
 */
export function pantallaInicial(rol: Rol, pacientesHabilitado: boolean): "/pacientes" | "/gestion" | null {
  if (pacientesHabilitado) return "/pacientes";
  return veGestion(rol) ? "/gestion" : null;
}
