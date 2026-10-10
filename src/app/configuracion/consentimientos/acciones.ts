"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CAMPOS_PLANTILLA, validarPlantilla, type CampoPlantilla } from "@/lib/clinico/consentimientos";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS = ["tipo", ...Object.keys(CAMPOS_PLANTILLA), "es_ejemplo", "revisada", "activa"];

export type EstadoPlantilla = {
  errores: Partial<Record<CampoPlantilla, string>>; general: string | null; valores: Record<string, string>;
};

/** Crea o edita una plantilla (solo administrador; la base lo vuelve a exigir). */
export async function guardarPlantilla(_previo: EstadoPlantilla, form: FormData): Promise<EstadoPlantilla> {
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")]));
  const id = String(form.get("id") ?? "") || null;
  // Casilla «Activa» (solo al editar): desmarcada no se envía.
  if (id) valores.activa = form.get("activa") === "1" ? "1" : "0";
  const fallo = (general: string | null, errores: EstadoPlantilla["errores"] = {}): EstadoPlantilla =>
    ({ errores, general, valores });
  if (!modulos.etapa7) return fallo("Este módulo aún no está habilitado.");
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") return fallo("Solo el administrador mantiene las plantillas.");
  if (id !== null && !UUID.test(id)) return fallo("Plantilla inválida.");
  const r = validarPlantilla((c) => valores[c] ?? "");
  if (!r.ok) return fallo(null, r.errores);

  const supabase = await createClient();
  const { tipo, es_ejemplo: esEjemplo, ...textos } = r.datos;
  const { data, error } = id
    // El tipo no cambia (los consentimientos ya generados dependen de él).
    ? await supabase.from("plantilla_consentimiento").update({ ...textos, es_ejemplo: esEjemplo }).eq("id", id)
        .select("id").maybeSingle<{ id: string }>()
    : await supabase.from("plantilla_consentimiento")
        .insert({ tipo, nombre: textos.nombre, descripcion: textos.descripcion, riesgos: textos.riesgos,
                  efectos_adversos: textos.efectos_adversos, pronostico: textos.pronostico, clinica_id: sesion.clinicaId })
        .select("id").maybeSingle<{ id: string }>();
  if (error?.code === "23505") return fallo(null, { nombre: "Ya hay una plantilla con este nombre." });
  if (error || !data) {
    registrarError("plantilla_consentimiento.guardar", error ?? "sin fila", { id });
    return fallo("No se pudo guardar la plantilla. Inténtalo de nuevo.");
  }
  revalidatePath("/configuracion/consentimientos");
  redirect(`/configuracion/consentimientos?guardada=${encodeURIComponent(textos.nombre)}`);
}

export type EstadoAsignar = { error: string | null; mensaje: string | null };

/** Elige qué plantilla usa un procedimiento del catálogo (el «cuál» de CLAUDE.md). */
export async function asignarPlantilla(_previo: EstadoAsignar, form: FormData): Promise<EstadoAsignar> {
  if (!modulos.etapa7) return { error: "Este módulo aún no está habilitado.", mensaje: null };
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") return { error: "Solo el administrador mantiene el catálogo.", mensaje: null };
  const procedimiento = String(form.get("procedimiento_id") ?? "");
  const plantilla = String(form.get("plantilla_id") ?? "");
  if (!UUID.test(procedimiento) || (plantilla !== "" && !UUID.test(plantilla))) return { error: "Datos inválidos.", mensaje: null };
  const supabase = await createClient();
  const { data, error } = await supabase.from("procedimiento").update({ consentimiento_plantilla_id: plantilla || null })
    .eq("id", procedimiento).select("id").maybeSingle<{ id: string }>();
  if (error || !data) {
    if (error?.code === "P0001") return { error: `${error.message}.`, mensaje: null };
    registrarError("catalogo.plantilla", error ?? "sin fila", { procedimiento });
    return { error: "No se pudo guardar. Inténtalo de nuevo.", mensaje: null };
  }
  revalidatePath("/configuracion/procedimientos");
  revalidatePath("/configuracion/consentimientos");
  return { error: null, mensaje: "Plantilla guardada." };
}
