import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Especialidad } from "@/lib/catalogo/validacion";
import { modulos } from "@/lib/funciones";
import { obtenerSesion, type Sesion } from "@/lib/sesion";

export type Procedimiento = {
  id: string;
  codigo: string;
  nombre: string;
  especialidad: Especialidad;
  precio_base_centimos: number;
  duracion_minutos: number;
  requiere_consentimiento: boolean;
  control_dias: number | null;
  activo: boolean;
};

export const COLUMNAS_PROCEDIMIENTO =
  "id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos, requiere_consentimiento, control_dias, activo";

/** Páginas del catálogo: módulo encendido y solo administrador. */
export async function sesionAdminCatalogo(): Promise<Sesion> {
  if (!modulos.etapa2) notFound();
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") redirect("/");
  return sesion;
}
