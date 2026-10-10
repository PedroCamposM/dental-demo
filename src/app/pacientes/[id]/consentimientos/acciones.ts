"use server";

import { revalidatePath } from "next/cache";
import { validarGenerar, validarMotivo, validarRegistro } from "@/lib/clinico/consentimientos";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoSimple = { error: string | null; mensaje: string | null; intento: number; exitos: number };

async function personal(pacienteId: string, soloDentista: boolean):
  Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa7) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion || (soloDentista ? !sesion.esDentista : !sesion.veClinico)) {
    return { error: soloDentista ? "Solo el cirujano dentista hace esto." : "Solo el personal clínico registra consentimientos." };
  }
  return { error: null, sesion };
}

function mensajeDeError(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (error.code === "P0001" && error.message.startsWith("El paciente está anulado")) {
    return "Este paciente está anulado o fusionado: regístralo en el paciente vigente.";
  }
  if (error.code === "P0001") return `${error.message}.`.replace(/\.\.$/, ".");
  if (error.code === "23505") return "Ya hay un consentimiento vigente para esto: imprímelo o anúlalo antes de generar otro.";
  registrarError(contexto, error);
  return `No se pudo ${que}. Inténtalo de nuevo.`;
}

const fallo = (previo: EstadoSimple, error: string): EstadoSimple =>
  ({ error, mensaje: null, intento: previo.intento + 1, exitos: previo.exitos });
const bien = (previo: EstadoSimple, mensaje: string): EstadoSimple =>
  ({ error: null, mensaje, intento: previo.intento + 1, exitos: previo.exitos + 1 });

/** Genera el formato (pendiente de firma) a partir de la plantilla. */
export async function generarConsentimiento(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const p = await personal(pacienteId, true);
  if (p.error !== null) return fallo(previo, p.error);
  const r = validarGenerar((c) => String(form.get(c) ?? ""), form.getAll("fines").map(String));
  if (!r.ok) return fallo(previo, r.error);
  const supabase = await createClient();
  const { error } = await supabase.from("consentimiento").insert({
    ...r.datos, clinica_id: p.sesion.clinicaId, paciente_id: pacienteId, profesional_id: p.sesion.usuarioId,
  });
  if (error) return fallo(previo, mensajeDeError(error, "consentimiento.generar", "generar el consentimiento"));
  revalidatePath(`/pacientes/${pacienteId}/consentimientos`);
  return bien(previo, "Formato generado: imprímelo para que lo firmen.");
}

/** Registra la firma o la negativa con el escaneo ya subido desde el navegador. */
export async function registrarFirma(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const p = await personal(pacienteId, false);
  if (p.error !== null) return fallo(previo, p.error);
  if (!UUID.test(id)) return fallo(previo, "Consentimiento inválido.");
  const r = validarRegistro((c) => String(form.get(c) ?? ""), {
    clinicaId: p.sesion.clinicaId, pacienteId, hoy: fechaLima(new Date()),
  });
  if (!r.ok) return fallo(previo, r.error);
  const supabase = await createClient();
  const { data: c } = await supabase.from("consentimiento").select("id").eq("id", id).eq("paciente_id", pacienteId)
    .maybeSingle<{ id: string }>();
  if (!c) return fallo(previo, "Consentimiento no encontrado. Recarga la página.");
  const { error } = await supabase.rpc("registrar_consentimiento", {
    id_consentimiento: id, decision: r.datos.decision, decidido: r.datos.decidido,
    ruta: r.datos.ruta, mime: r.datos.mime, bytes: r.datos.bytes, nombre: r.datos.nombre,
  });
  if (error?.code === "23505") return fallo(previo, "Ese escaneo ya está registrado: vuelve a elegir el archivo.");
  if (error) return fallo(previo, mensajeDeError(error, "consentimiento.registrar", "registrar el consentimiento"));
  revalidatePath(`/pacientes/${pacienteId}/consentimientos`);
  revalidatePath(`/pacientes/${pacienteId}/archivos`);
  return bien(previo, r.datos.decision === "firmado" ? "Consentimiento firmado registrado." : "Negativa registrada.");
}

/** Revocar (firmado) o anular (pendiente, generado por error). */
export async function cambiarConsentimiento(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const accion = String(form.get("accion") ?? "");
  const motivo = String(form.get("motivo") ?? "");
  const p = await personal(pacienteId, true);
  if (p.error !== null) return fallo(previo, p.error);
  if (!UUID.test(id) || (accion !== "revocar" && accion !== "anular")) return fallo(previo, "Cambio inválido.");
  const problema = validarMotivo(motivo, accion === "revocar" ? 300 : 200);
  if (problema) return fallo(previo, problema);
  const supabase = await createClient();
  const { data: c } = await supabase.from("consentimiento").select("id").eq("id", id).eq("paciente_id", pacienteId)
    .maybeSingle<{ id: string }>();
  if (!c) return fallo(previo, "Consentimiento no encontrado. Recarga la página.");
  const { error } = await supabase.rpc(accion === "revocar" ? "revocar_consentimiento" : "anular_consentimiento",
    { id_consentimiento: id, motivo: motivo.trim() });
  if (error) return fallo(previo, mensajeDeError(error, `consentimiento.${accion}`, "guardar el cambio"));
  revalidatePath(`/pacientes/${pacienteId}/consentimientos`);
  return bien(previo, accion === "revocar" ? "Consentimiento revocado." : "Formato anulado.");
}
