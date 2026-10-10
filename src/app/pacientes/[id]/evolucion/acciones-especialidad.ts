"use server";

import { revalidatePath } from "next/cache";
import { TABLA_REGISTRO, TIPOS_REGISTRO, validarRegistro, type TipoRegistro } from "@/lib/clinico/especialidades";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoRegistro = { error: string | null; mensaje: string | null; exitos: number };

function mensajeDeError(error: { code?: string; message: string }, contexto: string): string {
  if (error.code === "P0001") return `${error.message}.`.replace(/\.\.$/, ".");
  if (error.code === "23505") return "Ya hay un registro vigente de ese tipo: anúlalo antes de registrar otro.";
  if (error.code === "23514") return "Hay un dato fuera de rango. Revisa el formulario.";
  registrarError(contexto, error);
  return "No se pudo guardar el registro. Inténtalo de nuevo.";
}

const esTipo = (t: string): t is TipoRegistro => (TIPOS_REGISTRO as string[]).includes(t);

/** Registro de especialidad en la evolución en borrador (la base exige autor, ítem y especialidad). */
export async function registrarEspecialidad(previo: EstadoRegistro, form: FormData): Promise<EstadoRegistro> {
  const fallo = (error: string): EstadoRegistro => ({ error, mensaje: null, exitos: previo.exitos });
  if (!modulos.etapa9) return fallo("Este módulo aún no está habilitado.");
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return fallo("Los registros de especialidad los escribe el cirujano dentista.");
  const tipo = String(form.get("tipo") ?? "");
  const pacienteId = String(form.get("paciente_id") ?? "");
  const notaId = String(form.get("nota_id") ?? "");
  if (!esTipo(tipo) || !UUID.test(pacienteId) || !UUID.test(notaId)) return fallo("Datos inválidos. Recarga la página.");
  const r = validarRegistro(tipo, (c) => String(form.get(c) ?? ""));
  if (!r.ok) return fallo(r.error);
  const fila: Record<string, string | number | boolean | null> = { clinica_id: sesion.clinicaId, nota_id: notaId, ...r.datos };
  if (tipo === "implante_fase") {
    const implante = String(form.get("implante_id") ?? "");
    if (!UUID.test(implante)) return fallo("Elige el implante.");
    fila.implante_id = implante;
  } else {
    const item = String(form.get("item_plan_id") ?? "");
    if (item && !UUID.test(item)) return fallo("Ítem inválido.");
    if (!item && tipo !== "odontopediatria") return fallo("Falta el ítem del plan.");
    fila.item_plan_id = item || null;
  }
  if (tipo === "implante") {
    const pieza = Number(String(form.get("pieza") ?? "").trim());
    if (!Number.isInteger(pieza) || Math.floor(pieza / 10) < 1 || Math.floor(pieza / 10) > 4 || pieza % 10 < 1 || pieza % 10 > 8) {
      return fallo("Indica la pieza del implante (dentición permanente).");
    }
    fila.pieza = pieza;
  }
  const supabase = await createClient();
  const { error } = await supabase.from(TABLA_REGISTRO[tipo]).insert(fila);
  if (error) return fallo(mensajeDeError(error, `especialidad.${tipo}`));
  revalidatePath(`/pacientes/${pacienteId}/evolucion`);
  revalidatePath(`/pacientes/${pacienteId}/especialidades`);
  return { error: null, mensaje: "Registrado.", exitos: previo.exitos + 1 };
}

export async function anularRegistroEspecialidad(previo: EstadoRegistro, form: FormData): Promise<EstadoRegistro> {
  const fallo = (error: string): EstadoRegistro => ({ error, mensaje: null, exitos: previo.exitos });
  if (!modulos.etapa9) return fallo("Este módulo aún no está habilitado.");
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return fallo("Solo el autor de la evolución anula sus registros.");
  const tipo = String(form.get("tipo") ?? "");
  const id = String(form.get("id") ?? "");
  const pacienteId = String(form.get("paciente_id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!esTipo(tipo) || !UUID.test(id) || !UUID.test(pacienteId)) return fallo("Datos inválidos.");
  if (motivo.length < 5) return fallo("Escribe por qué se anula (al menos 5 caracteres).");
  if (motivo.length > 300) return fallo("Motivo: máximo 300 caracteres.");
  const supabase = await createClient();
  const { data, error } = await supabase.from(TABLA_REGISTRO[tipo])
    .update({ anulado_at: new Date().toISOString(), anulado_por: sesion.usuarioId, motivo_anulacion: motivo })
    .eq("id", id).is("anulado_at", null).select("id").maybeSingle();
  if (error) return fallo(mensajeDeError(error, `especialidad.anular.${tipo}`));
  if (!data) return fallo("No se pudo anular. Recarga la página.");
  revalidatePath(`/pacientes/${pacienteId}/evolucion`);
  revalidatePath(`/pacientes/${pacienteId}/especialidades`);
  return { error: null, mensaje: "Anulado.", exitos: previo.exitos + 1 };
}
