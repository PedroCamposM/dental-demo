"use server";

import { revalidatePath } from "next/cache";
import { validarArchivo, type CampoArchivo } from "@/lib/clinico/archivos";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS = ["tipo", "mime", "bytes", "ruta", "nombre", "tomada_el", "pieza", "nota_id", "descripcion"];

async function clinico(pacienteId: string): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa7) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion?.veClinico) return { error: "Solo el personal clínico registra imágenes y archivos." };
  return { error: null, sesion };
}

function mensajeDeError(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (error.code === "P0001" && error.message.startsWith("El paciente está anulado")) {
    return "Este paciente está anulado o fusionado: regístralo en el paciente vigente.";
  }
  if (error.code === "P0001") return `${error.message}.`.replace(/\.\.$/, ".");
  registrarError(contexto, error);
  return `No se pudo ${que}. Inténtalo de nuevo.`;
}

export type EstadoArchivo = {
  errores: Partial<Record<CampoArchivo | "general", string>>;
  mensaje: string | null;
  intento: number;
  /** Envíos correctos: cambia la `key` del formulario para limpiarlo. */
  exitos: number;
};

/**
 * Registra un archivo ya subido al bucket desde el navegador (así no pasa por el
 * servidor de la app ni por su límite de tamaño). La base exige que el objeto exista.
 */
export async function registrarArchivo(previo: EstadoArchivo, form: FormData): Promise<EstadoArchivo> {
  const intento = previo.intento + 1;
  const fallo = (errores: EstadoArchivo["errores"]): EstadoArchivo =>
    ({ errores, mensaje: null, intento, exitos: previo.exitos });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const c = await clinico(pacienteId);
  if (c.error !== null) return fallo({ general: c.error });
  const valores = Object.fromEntries(CAMPOS.map((k) => [k, String(form.get(k) ?? "")]));
  const r = validarArchivo((k) => valores[k] ?? "", {
    clinicaId: c.sesion.clinicaId, pacienteId, hoy: fechaLima(new Date()),
  });
  if (!r.ok) return fallo(r.errores);
  const supabase = await createClient();
  const { error } = await supabase.from("archivo_clinico").insert({
    ...r.datos, clinica_id: c.sesion.clinicaId, paciente_id: pacienteId, subido_por: c.sesion.usuarioId,
  });
  if (error) return fallo({ general: mensajeDeError(error, "archivos.registrar", "registrar el archivo") });
  revalidatePath(`/pacientes/${pacienteId}/archivos`);
  return { errores: {}, mensaje: "Archivo guardado.", intento, exitos: previo.exitos + 1 };
}

export type EstadoSimple = { error: string | null; ok: boolean; intento: number; texto: string };

export async function anularArchivo(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  const intento = previo.intento + 1;
  const fallo = (error: string): EstadoSimple => ({ error, ok: false, intento, texto: motivo });
  const c = await clinico(pacienteId);
  if (c.error !== null) return fallo(c.error);
  if (!UUID.test(id)) return fallo("Archivo inválido.");
  if (motivo.length < 3) return fallo("Escribe por qué se anula.");
  if (motivo.length > 200) return fallo("Máximo 200 caracteres.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("archivo_clinico")
    .update({ anulado_at: new Date().toISOString(), anulado_por: c.sesion.usuarioId, motivo_anulacion: motivo })
    .eq("id", id).eq("paciente_id", pacienteId).is("anulado_at", null).select("id").maybeSingle();
  if (error) return fallo(mensajeDeError(error, "archivos.anular", "anular el archivo"));
  if (!data) return fallo("Solo anula quien lo subió o un cirujano dentista. Recarga la página.");
  revalidatePath(`/pacientes/${pacienteId}/archivos`);
  return { error: null, ok: true, intento, texto: "" };
}
