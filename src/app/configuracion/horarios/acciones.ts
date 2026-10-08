"use server";

import { revalidatePath } from "next/cache";
import { validarBloqueo, validarSemana, type CampoBloqueo, type EntradaBloqueo } from "@/lib/agenda/horario";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUTA = "/configuracion/horarios";

export type EstadoSimple = { error: string | null; mensaje: string | null };

async function adminActual() {
  if (!modulos.etapa2) return null;
  const sesion = await obtenerSesion();
  return sesion?.rol === "admin" ? sesion : null;
}

/** Mensaje de la base que se puede mostrar tal cual (validaciones propias, en español). */
function mensajeBase(error: { code?: string; message: string }, porDefecto: string): string {
  return error.code === "P0001" ? `${error.message}.`.replace(/\.\.$/, ".") : porDefecto;
}

export async function crearSillon(_previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const sesion = await adminActual();
  if (!sesion) return { error: "Solo el administrador configura los sillones.", mensaje: null };
  const nombre = String(form.get("nombre") ?? "").trim().replace(/\s+/g, " ");
  if (nombre.length < 1 || nombre.length > 40) return { error: "Escribe un nombre de hasta 40 caracteres.", mensaje: null };
  const supabase = await createClient();
  const { error } = await supabase.from("sillon").insert({ clinica_id: sesion.clinicaId, nombre });
  if (error?.code === "23505") return { error: "Ya hay un sillón con ese nombre.", mensaje: null };
  if (error) {
    registrarError("horarios.sillon", error);
    return { error: "No se pudo agregar el sillón. Inténtalo de nuevo.", mensaje: null };
  }
  revalidatePath(RUTA);
  return { error: null, mensaje: `${nombre} agregado.` };
}

export async function cambiarEstadoSillon(_previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const sesion = await adminActual();
  if (!sesion) return { error: "Solo el administrador configura los sillones.", mensaje: null };
  const id = String(form.get("id") ?? "");
  const activo = form.get("activo") === "1";
  if (!UUID.test(id)) return { error: "Sillón inválido.", mensaje: null };
  const supabase = await createClient();
  if (!activo) {
    const { count } = await supabase.from("horario_profesional").select("id", { count: "exact", head: true })
      .eq("sillon_id", id).eq("activo", true);
    if ((count ?? 0) > 0) {
      return { error: "Este sillón está en el horario de algún profesional: reasígnalo antes de desactivarlo.", mensaje: null };
    }
  }
  const { data, error } = await supabase.from("sillon").update({ activo }).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    registrarError("horarios.sillon_estado", error ?? "sin fila", { id });
    return { error: "No se pudo cambiar el sillón. Inténtalo de nuevo.", mensaje: null };
  }
  revalidatePath(RUTA);
  return { error: null, mensaje: activo ? "Sillón activado." : "Sillón desactivado." };
}

export type EstadoHorario = { error: string | null; errores: Record<number, string>; mensaje: string | null };

export async function guardarHorario(_previo: EstadoHorario, form: FormData): Promise<EstadoHorario> {
  const sesion = await adminActual();
  if (!sesion) return { error: "Solo el administrador configura los horarios.", errores: {}, mensaje: null };
  const profesional = String(form.get("profesional_id") ?? "");
  if (!UUID.test(profesional)) return { error: "Profesional inválido.", errores: {}, mensaje: null };
  const r = validarSemana((c) => String(form.get(c) ?? "").trim());
  if (!r.ok) return { error: "Revisa los días marcados.", errores: r.errores, mensaje: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_horario_semanal", { profesional, dias: r.dias });
  if (error) {
    if (error.code !== "P0001") registrarError("horarios.guardar", error, { profesional });
    return { error: mensajeBase(error, "No se pudo guardar el horario. Inténtalo de nuevo."), errores: {}, mensaje: null };
  }
  revalidatePath(RUTA);
  revalidatePath("/agenda");
  const dias = r.dias.filter((d) => d.activo).length;
  return { error: null, errores: {}, mensaje: dias === 0 ? "Horario guardado: no atiende ningún día." : "Horario guardado." };
}

export type EstadoBloqueo = {
  errores: Partial<Record<CampoBloqueo, string>>; general: string | null; mensaje: string | null; valores: EntradaBloqueo;
};
const CAMPOS_BLOQUEO: CampoBloqueo[] = ["tipo", "profesional_id", "desde", "desde_hora", "hasta", "hasta_hora", "motivo"];

export async function crearBloqueo(_previo: EstadoBloqueo, form: FormData): Promise<EstadoBloqueo> {
  const valores: EntradaBloqueo = Object.fromEntries(CAMPOS_BLOQUEO.map((c) => [c, String(form.get(c) ?? "")]));
  const fallo = (general: string | null, errores: EstadoBloqueo["errores"] = {}): EstadoBloqueo =>
    ({ errores, general, mensaje: null, valores });
  const sesion = await adminActual();
  if (!sesion) return fallo("Solo el administrador bloquea la agenda.");
  const r = validarBloqueo(valores, new Date());
  if (!r.ok) return fallo(null, r.errores);

  const supabase = await createClient();
  const { error } = await supabase.from("bloqueo_agenda").insert({
    ...r.datos, clinica_id: sesion.clinicaId, creado_por: sesion.usuarioId,
  });
  if (error) {
    registrarError("horarios.bloqueo", error);
    return fallo("No se pudo crear el bloqueo. Inténtalo de nuevo.");
  }
  // Las citas ya agendadas no se tocan: se avisa para reprogramarlas.
  let citas = supabase.from("cita").select("id", { count: "exact", head: true })
    .in("estado", ["programada", "confirmada"]).lt("inicio", r.datos.fin).gt("fin", r.datos.inicio);
  if (r.datos.profesional_id) citas = citas.eq("odontologo_id", r.datos.profesional_id);
  const { count } = await citas;
  revalidatePath(RUTA);
  revalidatePath("/agenda");
  const aviso = (count ?? 0) > 0
    ? ` Hay ${count} ${count === 1 ? "cita agendada" : "citas agendadas"} en ese rango: reprográmalas desde la agenda.`
    : "";
  return { errores: {}, general: null, mensaje: `Bloqueo creado.${aviso}`, valores: {} };
}

export async function anularBloqueo(_previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const sesion = await adminActual();
  if (!sesion) return { error: "Solo el administrador anula bloqueos.", mensaje: null };
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!UUID.test(id)) return { error: "Bloqueo inválido.", mensaje: null };
  if (motivo.length < 3) return { error: "Escribe por qué se anula.", mensaje: null };
  const supabase = await createClient();
  const { data, error } = await supabase.from("bloqueo_agenda")
    .update({ anulado_at: new Date().toISOString(), anulado_por: sesion.usuarioId, motivo_anulacion: motivo })
    .eq("id", id).is("anulado_at", null).select("id").maybeSingle();
  if (error || !data) {
    if (error) registrarError("horarios.anular_bloqueo", error, { id });
    return { error: "No se pudo anular el bloqueo. Recarga la página e inténtalo de nuevo.", mensaje: null };
  }
  revalidatePath(RUTA);
  revalidatePath("/agenda");
  return { error: null, mensaje: "Bloqueo anulado." };
}
