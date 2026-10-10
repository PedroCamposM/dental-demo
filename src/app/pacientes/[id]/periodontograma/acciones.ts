"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validarPiezas } from "@/lib/clinico/periodonto";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoPerio = { error: string | null; mensaje: string | null; intento: number };

/** Personal clínico (cirujano dentista o asistente) con el módulo encendido. */
async function clinico(pacienteId: string): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa9) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion?.veClinico) return { error: "El periodontograma lo registran el cirujano dentista o la asistente." };
  return { error: null, sesion };
}

function mensajeDeError(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (error.code === "P0001" && error.message.startsWith("El paciente está anulado")) {
    return "Este paciente está anulado o fusionado: regístralo en el paciente vigente.";
  }
  if (error.code === "P0001") return `${error.message}.`.replace(/\.\.$/, ".");
  if (error.code === "23514") return "Hay un valor fuera de rango. Revisa las mediciones.";
  registrarError(contexto, error);
  return `No se pudo ${que}. Inténtalo de nuevo.`;
}

const ruta = (pacienteId: string) => `/pacientes/${pacienteId}/periodontograma`;

export async function nuevoPeriodontograma(previo: EstadoPerio, form: FormData): Promise<EstadoPerio> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const intento = previo.intento + 1;
  const c = await clinico(pacienteId);
  if (c.error !== null) return { error: c.error, mensaje: null, intento };
  // El cirujano dentista lo toma a su nombre (la base lo exige); la asistente elige el responsable.
  const responsable = c.sesion.esDentista ? c.sesion.usuarioId : String(form.get("odontologo_id") ?? "");
  if (!UUID.test(responsable)) return { error: "Elige el cirujano dentista responsable.", mensaje: null, intento };
  const supabase = await createClient();
  const { data, error } = await supabase.from("periodontograma").insert({
    clinica_id: c.sesion.clinicaId, paciente_id: pacienteId, odontologo_id: responsable,
  }).select("id").single<{ id: string }>();
  if (error || !data) {
    return { error: error ? mensajeDeError(error, "periodonto.nuevo", "abrir el periodontograma") : "No se pudo abrir.",
      mensaje: null, intento };
  }
  revalidatePath(ruta(pacienteId));
  redirect(`${ruta(pacienteId)}?p=${data.id}`);
}

/** Guarda las mediciones del borrador; con «Firmar», además lo firma (solo el responsable). */
export async function guardarPeriodontograma(previo: EstadoPerio, form: FormData): Promise<EstadoPerio> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const firmar = form.get("accion") === "firmar";
  const intento = previo.intento + 1;
  const fallo = (error: string): EstadoPerio => ({ error, mensaje: null, intento });
  const c = await clinico(pacienteId);
  if (c.error !== null) return fallo(c.error);
  if (!UUID.test(id)) return fallo("Periodontograma inválido. Recarga la página.");
  const r = validarPiezas(String(form.get("piezas") ?? "[]"));
  if (!r.ok) return fallo(r.error);
  const obs = String(form.get("observaciones") ?? "").trim();
  if (obs.length > 2000) return fallo("Observaciones: máximo 2000 caracteres.");
  const textoMeses = String(form.get("mantenimiento_meses") ?? "").trim();
  const meses = textoMeses === "" ? null : Number(textoMeses);
  if (meses !== null && (!Number.isInteger(meses) || meses < 1 || meses > 24)) {
    return fallo("El mantenimiento se indica en meses, de 1 a 24.");
  }
  if (firmar && !r.piezas.some((p) => !p.ausente && p.ps.some((x) => x !== null))) {
    return fallo("Registra al menos una medición de sondaje antes de firmar.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_periodontograma", {
    id_periodontograma: id, piezas: r.piezas, observaciones: obs, mantenimiento_meses: meses,
  });
  if (error) return fallo(mensajeDeError(error, "periodonto.guardar", "guardar el periodontograma"));
  if (firmar) {
    const f = await supabase.rpc("firmar_periodontograma", { id_periodontograma: id });
    revalidatePath(ruta(pacienteId));
    if (f.error) return fallo(`Se guardó, pero no se firmó: ${mensajeDeError(f.error, "periodonto.firmar", "firmarlo")}`);
    // Firmado, la grilla pasa a solo lectura: el aviso lo muestra la página.
    redirect(`${ruta(pacienteId)}?p=${id}&firmado=1`);
  }
  revalidatePath(ruta(pacienteId));
  return { error: null, mensaje: "Borrador guardado.", intento };
}

export async function anularPeriodontograma(previo: EstadoPerio, form: FormData): Promise<EstadoPerio> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  const intento = previo.intento + 1;
  const fallo = (error: string): EstadoPerio => ({ error, mensaje: null, intento });
  const c = await clinico(pacienteId);
  if (c.error !== null) return fallo(c.error);
  if (!UUID.test(id)) return fallo("Periodontograma inválido.");
  if (motivo.length < 5) return fallo("Escribe por qué se anula (al menos 5 caracteres).");
  if (motivo.length > 300) return fallo("Motivo: máximo 300 caracteres.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("periodontograma")
    .update({ anulado_at: new Date().toISOString(), anulado_por: c.sesion.usuarioId, motivo_anulacion: motivo })
    .eq("id", id).is("anulado_at", null).select("id").maybeSingle();
  if (error) return fallo(mensajeDeError(error, "periodonto.anular", "anular el periodontograma"));
  if (!data) return fallo("No se pudo anular. Recarga la página.");
  revalidatePath(ruta(pacienteId));
  return { error: null, mensaje: "Periodontograma anulado.", intento };
}
