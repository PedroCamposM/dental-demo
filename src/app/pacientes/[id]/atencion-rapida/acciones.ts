"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { codigosElegibles, type CodigoCie10 } from "@/lib/clinico/diagnostico";
import { validarAtencionRapida, type CampoAtencion, type ProcedimientoRapido } from "@/lib/clinico/atencion-rapida";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_PACIENTE, puedeGestar, type PacienteClinico } from "../datos-clinicos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `valores` devuelve lo escrito si hay que corregir algo (no se pierde nada). */
export type EstadoAtencion = {
  errores: Partial<Record<CampoAtencion | "general", string>>; valores: Record<string, string>; intento: number;
};

export async function registrarAtencion(previo: EstadoAtencion, form: FormData): Promise<EstadoAtencion> {
  const valores: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") valores[k] = v;
  const intento = previo.intento + 1;
  const fallo = (errores: EstadoAtencion["errores"]): EstadoAtencion => ({ errores, valores, intento });
  const pacienteId = valores.paciente_id ?? "";
  if (!modulos.etapa14) return fallo({ general: "Este módulo aún no está habilitado." });
  if (!UUID.test(pacienteId)) return fallo({ general: "Paciente inválido." });
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return fallo({ general: "Solo el cirujano dentista registra la atención." });

  const supabase = await createClient();
  const [cie10, procedimientos, paciente] = await Promise.all([
    supabase.from("catalogo_cie10").select("codigo, descripcion, es_categoria").returns<CodigoCie10[]>(),
    supabase.from("procedimiento").select("id, nombre, requiere_consentimiento").eq("activo", true).returns<ProcedimientoRapido[]>(),
    supabase.from("paciente").select(COLUMNAS_PACIENTE).eq("id", pacienteId).maybeSingle<PacienteClinico>(),
  ]);
  if (cie10.error || procedimientos.error || paciente.error) {
    registrarError("atencion_rapida.catalogos", cie10.error ?? procedimientos.error ?? paciente.error);
    return fallo({ general: "No se pudieron cargar los catálogos. Inténtalo de nuevo." });
  }
  if (!paciente.data) return fallo({ general: "Paciente no encontrado." });
  const elegibles = new Set(codigosElegibles(cie10.data ?? []).map((c) => c.codigo));
  const r = validarAtencionRapida((c) => valores[c] ?? "", {
    codigosCie10: elegibles, procedimientos: procedimientos.data ?? [], puedeGestar: puedeGestar(paciente.data),
    categorias: new Set((cie10.data ?? []).filter((c) => !elegibles.has(c.codigo)).map((c) => c.codigo)),
  });
  if (!r.ok) return fallo(r.errores);

  // Todo en una transacción: o queda la atención completa o no queda nada.
  const { data, error } = await supabase.rpc("registrar_atencion_rapida", { id_paciente: pacienteId, datos: r.datos });
  const planId = (data as { plan_id?: string } | null)?.plan_id;
  if (error || !planId) {
    if (error?.code === "P0001") return fallo({ general: error.message });
    registrarError("atencion_rapida.registrar", error, { paciente: pacienteId });
    return fallo({ general: "No se pudo registrar la atención. Inténtalo de nuevo." });
  }
  revalidatePath(`/pacientes/${pacienteId}`, "layout");
  redirect(`/pacientes/${pacienteId}/plan?p=${planId}&atendido=1`);
}
