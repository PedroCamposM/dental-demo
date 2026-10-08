"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validarProcedimiento, type CampoProcedimiento, type EntradaProcedimiento } from "@/lib/catalogo/validacion";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export type EstadoProcedimiento = {
  errores: Partial<Record<CampoProcedimiento, string>>;
  general: string | null;
  valores: EntradaProcedimiento;
};

const CAMPOS: CampoProcedimiento[] = [
  "codigo", "nombre", "especialidad", "precio", "duracion_minutos", "requiere_consentimiento", "control_dias", "activo",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Crea o edita un procedimiento del catálogo (solo administrador; la base lo vuelve a exigir). */
export async function guardarProcedimiento(_previo: EstadoProcedimiento, form: FormData): Promise<EstadoProcedimiento> {
  const valores: EntradaProcedimiento = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")]));
  const id = String(form.get("id") ?? "") || null;
  // La casilla «Activo» solo existe al editar: desmarcada no se envía.
  if (id) valores.activo = form.get("activo") === "1" ? "1" : "0";
  const fallo = (general: string | null, errores: EstadoProcedimiento["errores"] = {}) => ({ errores, general, valores });

  if (!modulos.etapa2) return fallo("Este módulo aún no está habilitado.");
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") return fallo("Solo el administrador mantiene el catálogo.");
  if (id !== null && !UUID.test(id)) return fallo("Procedimiento inválido.");

  const r = validarProcedimiento(valores);
  if (!r.ok) return fallo(null, r.errores);

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("procedimiento").update(r.datos).eq("id", id).select("id").maybeSingle<{ id: string }>()
    : await supabase.from("procedimiento").insert({ ...r.datos, clinica_id: sesion.clinicaId })
        .select("id").maybeSingle<{ id: string }>();

  if (error?.code === "23505") {
    return error.message.includes("nombre")
      ? fallo(null, { nombre: "Ya hay un procedimiento con este nombre." })
      : fallo(null, { codigo: "Ya hay un procedimiento con este código." });
  }
  if (error || !data) {
    registrarError("catalogo.guardar", error ?? "sin fila", { id });
    return fallo("No se pudo guardar el procedimiento. Inténtalo de nuevo.");
  }
  revalidatePath("/configuracion/procedimientos");
  redirect(`/configuracion/procedimientos?guardado=${encodeURIComponent(r.datos.codigo)}`);
}
