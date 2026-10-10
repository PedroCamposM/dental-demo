"use server";

import { revalidatePath } from "next/cache";
import { validarMotivo } from "@/lib/clinico/consentimientos";
import { validarInterconsulta, validarRespuesta, type CampoInterconsulta } from "@/lib/clinico/interconsultas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS: CampoInterconsulta[] = ["tipo", "destinatario_id", "destino", "motivo", "datos_clinicos", "nota_id"];

async function personal(pacienteId: string, soloDentista: boolean):
  Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa7) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion || (soloDentista ? !sesion.esDentista : !sesion.veClinico)) {
    return { error: soloDentista ? "Solo el cirujano dentista pide interconsultas." : "Solo el personal clínico registra respuestas." };
  }
  return { error: null, sesion };
}

function mensajeDeError(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (error.code === "P0001" && error.message.startsWith("El paciente está anulado")) {
    return "Este paciente está anulado o fusionado: regístralo en el paciente vigente.";
  }
  if (error.code === "P0001") return `${error.message}.`.replace(/\.\.$/, ".");
  if (error.code === "23505") return "Ese documento ya está registrado: vuelve a elegir el archivo.";
  registrarError(contexto, error);
  return `No se pudo ${que}. Inténtalo de nuevo.`;
}

export type EstadoInterconsulta = {
  errores: Partial<Record<CampoInterconsulta | "general", string>>; mensaje: string | null; exitos: number;
  valores: Record<string, string>;
};

export async function pedirInterconsulta(previo: EstadoInterconsulta, form: FormData): Promise<EstadoInterconsulta> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")]));
  const fallo = (errores: EstadoInterconsulta["errores"]): EstadoInterconsulta =>
    ({ errores, mensaje: null, exitos: previo.exitos, valores });
  const p = await personal(pacienteId, true);
  if (p.error !== null) return fallo({ general: p.error });
  const r = validarInterconsulta((c) => valores[c] ?? "");
  if (!r.ok) return fallo(r.errores);
  const supabase = await createClient();
  const { error } = await supabase.from("interconsulta").insert({
    ...r.datos, clinica_id: p.sesion.clinicaId, paciente_id: pacienteId, solicitante_id: p.sesion.usuarioId,
  });
  if (error) return fallo({ general: mensajeDeError(error, "interconsulta.pedir", "registrar la interconsulta") });
  revalidatePath(`/pacientes/${pacienteId}/interconsultas`);
  revalidatePath("/pacientes");
  return {
    errores: {}, exitos: previo.exitos + 1, valores: {},
    mensaje: r.datos.tipo === "interna" ? "Interconsulta enviada: el profesional la verá en sus pendientes."
      : "Interconsulta registrada: imprímela para el paciente.",
  };
}

export type EstadoSimple = { error: string | null; mensaje: string | null; intento: number };

export async function responderInterconsulta(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const intento = previo.intento + 1;
  const p = await personal(pacienteId, false);
  if (p.error !== null) return { error: p.error, mensaje: null, intento };
  if (!UUID.test(id)) return { error: "Interconsulta inválida.", mensaje: null, intento };
  const r = validarRespuesta((c) => String(form.get(c) ?? ""), { clinicaId: p.sesion.clinicaId, pacienteId });
  if (!r.ok) return { error: r.error, mensaje: null, intento };
  const supabase = await createClient();
  const { data: ic } = await supabase.from("interconsulta").select("id").eq("id", id).eq("paciente_id", pacienteId)
    .maybeSingle<{ id: string }>();
  if (!ic) return { error: "Interconsulta no encontrada. Recarga la página.", mensaje: null, intento };
  const { error } = await supabase.rpc("responder_interconsulta", {
    id_interconsulta: id, texto: r.datos.texto, ruta: r.datos.ruta, mime: r.datos.mime, bytes: r.datos.bytes,
    nombre: r.datos.nombre,
  });
  if (error) return { error: mensajeDeError(error, "interconsulta.responder", "registrar la respuesta"), mensaje: null, intento };
  revalidatePath(`/pacientes/${pacienteId}/interconsultas`);
  revalidatePath("/pacientes");
  return { error: null, mensaje: "Respuesta registrada.", intento };
}

export async function cancelarInterconsulta(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "");
  const intento = previo.intento + 1;
  const p = await personal(pacienteId, true);
  if (p.error !== null) return { error: p.error, mensaje: null, intento };
  if (!UUID.test(id)) return { error: "Interconsulta inválida.", mensaje: null, intento };
  const problema = validarMotivo(motivo, 200);
  if (problema) return { error: problema, mensaje: null, intento };
  const supabase = await createClient();
  const { data: ic } = await supabase.from("interconsulta").select("id").eq("id", id).eq("paciente_id", pacienteId)
    .maybeSingle<{ id: string }>();
  if (!ic) return { error: "Interconsulta no encontrada. Recarga la página.", mensaje: null, intento };
  const { error } = await supabase.rpc("cancelar_interconsulta", { id_interconsulta: id, motivo: motivo.trim() });
  if (error) return { error: mensajeDeError(error, "interconsulta.cancelar", "cancelar"), mensaje: null, intento };
  revalidatePath(`/pacientes/${pacienteId}/interconsultas`);
  revalidatePath("/pacientes");
  return { error: null, mensaje: "Interconsulta cancelada.", intento };
}
