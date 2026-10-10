"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import {
  CAMPOS_NTS139, validarPaciente, type EntradaPaciente, type Errores, type CampoPaciente, type PacienteValidado,
} from "@/lib/pacientes/validacion";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export type Duplicado = {
  id: string; nombres: string; apellidos: string; tipo_documento: string; numero_documento: string | null;
  telefono: string | null; fecha_nacimiento: string | null;
};

export type EstadoFormulario = {
  errores: Errores;
  general: string | null;
  consentimiento: string | null;
  /** Se devuelve para que la casilla siga marcada si hay que corregir algo y volver a enviar. */
  consiente: boolean;
  duplicados: Duplicado[];
  valores: EntradaPaciente;
};

const CAMPOS: CampoPaciente[] = [
  "tipo_documento", "numero_documento", "nombres", "apellidos", "fecha_nacimiento", "sexo", "telefono", "ocupacion",
  "direccion", "contacto_emergencia_nombre", "contacto_emergencia_telefono", "contacto_emergencia_parentesco",
  "apoderado_nombre", "apoderado_dni", "apoderado_telefono", "apoderado_parentesco", ...CAMPOS_NTS139,
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Crea o actualiza un paciente. Valida en el servidor y avisa de posibles duplicados antes de crear. */
export async function guardarPaciente(_previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const valores: EntradaPaciente = Object.fromEntries(CAMPOS.map((c) => [c, String(form.get(c) ?? "")]));
  const id = String(form.get("id") ?? "") || null;
  const confirmaDuplicado = form.get("confirmar_duplicado") === "1";
  const consiente = form.get("consentimiento_datos") === "1";
  const vacio: EstadoFormulario = { errores: {}, general: null, consentimiento: null, consiente, duplicados: [], valores };

  if (!modulos.etapa1) return { ...vacio, general: "Este módulo aún no está habilitado." };
  const sesion = await obtenerSesion();
  if (!sesion) return { ...vacio, general: "Tu usuario no tiene acceso a una clínica." };
  if (id !== null && !UUID.test(id)) return { ...vacio, general: "Paciente inválido." };

  const resultado = validarPaciente(valores, fechaLima(new Date()));
  const sinConsentimiento = !id && !consiente
    ? "Marca el consentimiento: el paciente (o su apoderado) autoriza el uso de sus datos (Ley 29733)." : null;
  if (!resultado.ok || sinConsentimiento) {
    return { ...vacio, errores: resultado.ok ? {} : resultado.errores, consentimiento: sinConsentimiento };
  }
  // Las columnas NTS 139 llegan con la migración 0908: sin la Etapa 3 no se envían.
  const datos: Partial<PacienteValidado> = { ...resultado.datos };
  if (!modulos.etapa3) for (const c of CAMPOS_NTS139) delete datos[c];

  const supabase = await createClient();

  if (!id && !confirmaDuplicado) {
    const { data: duplicados, error } = await supabase.rpc("posibles_duplicados", {
      nombres: resultado.datos.nombres, apellidos: resultado.datos.apellidos, fecha_nacimiento: resultado.datos.fecha_nacimiento,
    });
    if (error) {
      registrarError("pacientes.duplicados", error);
      return { ...vacio, general: "No pudimos revisar si el paciente ya existe. Inténtalo de nuevo." };
    }
    if ((duplicados ?? []).length > 0) return { ...vacio, duplicados: duplicados as Duplicado[] };
  }

  const { data, error } = id
    ? await supabase.from("paciente").update(datos).eq("id", id).is("anulado_at", null)
        .select("id").maybeSingle<{ id: string }>()
    : await supabase.from("paciente")
        .insert({ ...datos, clinica_id: sesion.clinicaId, consentimiento_datos_at: new Date().toISOString() })
        .select("id").maybeSingle<{ id: string }>();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ...vacio, errores: { numero_documento: "Ya hay un paciente registrado con este documento. Búscalo en Pacientes; si no aparece, está anulado: consulta al administrador." } };
    }
    if (id && !error) {
      return { ...vacio, general: "Este paciente está anulado o fusionado: su registro ya no se edita." };
    }
    if (error?.code === "P0001" && error.message.includes("anulado")) {
      return { ...vacio, general: "Este paciente está anulado o fusionado: su registro ya no se edita." };
    }
    if (error?.code === "P0001" && error.message.includes("apoderado")) {
      return { ...vacio, errores: { apoderado_nombre: "Es menor de edad: completa los datos del apoderado." } };
    }
    registrarError(id ? "pacientes.actualizar" : "pacientes.crear", error ?? "sin fila", { paciente: id });
    return { ...vacio, general: "No se pudo guardar el paciente. Revisa los datos e inténtalo de nuevo." };
  }

  revalidatePath("/pacientes");
  redirect(`/pacientes/${data.id}${id ? "?guardado=1" : "?creado=1"}`);
}

/** Devuelve lo elegido y lo escrito para que no se pierda si hay que corregir algo. */
export type EstadoFusion = { error: string | null; duplicado: string; motivo: string };

const MENSAJES_FUSION: [string, string][] = [
  ["apoderado", "Uno de los pacientes es menor y le faltan datos del apoderado: complétalos en su ficha y vuelve a intentar."],
  ["Solo el administrador", "Solo el administrador puede fusionar pacientes."],
  ["motivo", "Escribe el motivo de la fusión (al menos 5 caracteres)."],
  ["distintos", "Elige un registro distinto al paciente actual."],
  ["anulado", "Uno de los registros ya está anulado o fusionado."],
  ["no encontrado", "No encontramos uno de los pacientes."],
];

/** Absorbe el registro duplicado en el paciente que se conserva (función auditada en la base). */
export async function fusionarPacientes(_previo: EstadoFusion, form: FormData): Promise<EstadoFusion> {
  const conservar = String(form.get("conservar") ?? "");
  const duplicado = String(form.get("duplicado") ?? "");
  const motivoEscrito = String(form.get("motivo") ?? "");
  const motivo = motivoEscrito.trim();
  const fallo = (error: string): EstadoFusion => ({ error, duplicado, motivo: motivoEscrito });

  if (!modulos.etapa1) return fallo("Este módulo aún no está habilitado.");
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") return fallo("Solo el administrador puede fusionar pacientes.");
  if (!UUID.test(conservar) || !UUID.test(duplicado)) return fallo("Elige el registro duplicado.");
  if (motivo.length < 5) return fallo("Escribe el motivo de la fusión (al menos 5 caracteres).");

  const supabase = await createClient();
  const { error } = await supabase.rpc("fusionar_pacientes", { duplicado, conservar, motivo });
  if (error) {
    const conocido = MENSAJES_FUSION.find(([clave]) => error.message.includes(clave));
    if (!conocido) registrarError("pacientes.fusionar", error, { conservar, duplicado });
    return fallo(conocido?.[1] ?? "No se pudo fusionar. Inténtalo de nuevo.");
  }
  revalidatePath("/pacientes");
  redirect(`/pacientes/${conservar}?fusionado=1`);
}
