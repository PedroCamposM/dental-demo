"use server";

import { revalidatePath } from "next/cache";
import { validarAnamnesisRapida } from "@/lib/clinico/ficha-rapida";
import { modulos } from "@/lib/funciones";
import { DENTICIONES, type Denticion } from "@/lib/odontograma/hallazgo";
import { esSoloLectura, siSoloLectura } from "@/lib/prueba";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_PACIENTE, COLUMNAS_VERSION, puedeGestar, type PacienteClinico, type Version } from "../datos-clinicos";

// Etapa 21: la atención rápida es la ficha en una página (formato de la clínica piloto). Cada
// sección se guarda por separado y la página no cambia: estas acciones solo revalidan.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ruta = (id: string) => `/pacientes/${id}/atencion-rapida`;

async function dentista(pacienteId: string): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa14) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion?.esDentista) return { error: "Solo el cirujano dentista registra la atención." };
  return { error: null, sesion };
}

function mensaje(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (esSoloLectura(error)) return `${error.message}.`;
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Tu rol no puede hacer este cambio.";
  registrarError(contexto, error);
  return `No se pudo ${que}. Inténtalo de nuevo.`;
}

// ---------------------------------------------------------------------------
// Anamnesis: una versión nueva del cuestionario (lo que no pregunta la ficha se conserva)
// ---------------------------------------------------------------------------
export type EstadoAnamnesis = {
  errores: Record<string, string>; mensaje: string | null; intento: number;
  valores: { textos: Record<string, string>; enfermedades: string[] } | null;
};

export async function guardarAnamnesis(previo: EstadoAnamnesis, form: FormData): Promise<EstadoAnamnesis> {
  const intento = previo.intento + 1;
  const textos: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && k !== "enfermedades") textos[k] = v;
  const valores = { textos, enfermedades: form.getAll("enfermedades").map(String) };
  const fallo = (errores: Record<string, string>): EstadoAnamnesis => ({ errores, mensaje: null, intento, valores });
  const pacienteId = textos.paciente_id ?? "";
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo({ general: d.error });

  const supabase = await createClient();
  const [paciente, version] = await Promise.all([
    supabase.from("paciente").select(COLUMNAS_PACIENTE).eq("id", pacienteId).maybeSingle<PacienteClinico>(),
    supabase.from("cuestionario_salud").select(COLUMNAS_VERSION).eq("paciente_id", pacienteId)
      .order("version", { ascending: false }).limit(1).maybeSingle<Version>(),
  ]);
  if (!paciente.data) return fallo({ general: "Paciente no encontrado." });
  const r = validarAnamnesisRapida(
    { texto: (c) => textos[c] ?? "", lista: () => valores.enfermedades }, version.data ?? null, puedeGestar(paciente.data),
  );
  if (!r.ok) return fallo(r.errores as Record<string, string>);
  const { error } = await supabase.from("cuestionario_salud").insert({
    ...r.datos, clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, registrado_por: d.sesion.usuarioId,
  });
  if (error) return fallo({ general: mensaje(error, "ficha.anamnesis", "guardar la anamnesis") });
  revalidatePath(`/pacientes/${pacienteId}`, "layout");
  return { errores: {}, mensaje: "Anamnesis guardada.", intento, valores: null };
}

// ---------------------------------------------------------------------------
// Odontograma inicial (con sus especificaciones) y plan, si aún no hay
// ---------------------------------------------------------------------------
export type EstadoCrear = { error: string | null; intento: number; valores: Record<string, string> };

export async function crearOdontogramaFicha(previo: EstadoCrear, form: FormData): Promise<EstadoCrear> {
  const valores = { denticion: String(form.get("denticion") ?? ""), especificaciones: String(form.get("especificaciones") ?? "") };
  const fallo = (error: string): EstadoCrear => ({ error, intento: previo.intento + 1, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo(d.error);
  if (!modulos.etapa4) return fallo("El odontograma aún no está habilitado.");
  if (!Object.hasOwn(DENTICIONES, valores.denticion)) return fallo("Elige la dentición.");
  const especificaciones = valores.especificaciones.trim() || null;
  if ((especificaciones?.length ?? 0) > 1000) return fallo("Especificaciones: máximo 1000 caracteres.");
  const supabase = await createClient();
  const { count } = await supabase.from("odontograma").select("id", { count: "exact", head: true })
    .eq("paciente_id", pacienteId).is("anulado_at", null);
  const { error } = await supabase.from("odontograma").insert({
    clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, odontologo_id: d.sesion.usuarioId,
    tipo: (count ?? 0) > 0 ? "evolucion" : "inicial", denticion: valores.denticion as Denticion, especificaciones,
  });
  if (error) return fallo(siSoloLectura(error, mensaje(error, "ficha.odontograma", "crear el odontograma")));
  revalidatePath(ruta(pacienteId));
  revalidatePath(`/pacientes/${pacienteId}/odontograma`);
  return { error: null, intento: previo.intento + 1, valores: {} };
}

export async function crearPlanFicha(previo: EstadoCrear, form: FormData): Promise<EstadoCrear> {
  const fallo = (error: string): EstadoCrear => ({ error, intento: previo.intento + 1, valores: {} });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo(d.error);
  if (!modulos.etapa5) return fallo("El plan de tratamiento aún no está habilitado.");
  const supabase = await createClient();
  // Otra pestaña (o un doble clic) ya lo creó: no se duplica, solo se muestra.
  const { count: vigentes } = await supabase.from("plan_tratamiento").select("id", { count: "exact", head: true })
    .eq("paciente_id", pacienteId).in("estado", ["propuesto", "aceptado", "en_curso", "detenido"]);
  if ((vigentes ?? 0) > 0) {
    revalidatePath(ruta(pacienteId));
    return { error: null, intento: previo.intento + 1, valores: {} };
  }
  const { data: plan, error } = await supabase.from("plan_tratamiento").insert({
    clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, odontologo_id: d.sesion.usuarioId, titulo: "Plan de tratamiento",
  }).select("id").single<{ id: string }>();
  if (error || !plan) return fallo(error ? mensaje(error, "ficha.plan", "crear el plan") : "No se pudo crear el plan.");
  const { error: errorFase } = await supabase.from("plan_fase").insert({
    clinica_id: d.sesion.clinicaId, plan_id: plan.id, numero: 1, nombre: "Tratamiento",
  });
  if (errorFase) registrarError("ficha.plan_fase", errorFase, { plan: plan.id });
  revalidatePath(ruta(pacienteId));
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  return { error: null, intento: previo.intento + 1, valores: {} };
}

// ---------------------------------------------------------------------------
// Ficha de control: abre la evolución de hoy (borrador) sin salir de la ficha
// ---------------------------------------------------------------------------
export async function abrirLaborHoy(previo: EstadoCrear, form: FormData): Promise<EstadoCrear> {
  const fallo = (error: string): EstadoCrear => ({ error, intento: previo.intento + 1, valores: {} });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const d = await dentista(pacienteId);
  if (d.error !== null) return fallo(d.error);
  if (!modulos.etapa6) return fallo("La evolución aún no está habilitada.");
  const supabase = await createClient();
  // Si ya tiene un borrador abierto de este paciente, se usa ese (no se abre otro).
  const { count: abiertos } = await supabase.from("nota_evolucion").select("id", { count: "exact", head: true })
    .eq("paciente_id", pacienteId).eq("odontologo_id", d.sesion.usuarioId).is("firmada_at", null).is("anulado_at", null);
  if ((abiertos ?? 0) > 0) {
    revalidatePath(ruta(pacienteId));
    return { error: null, intento: previo.intento + 1, valores: {} };
  }
  const { error } = await supabase.from("nota_evolucion").insert({
    clinica_id: d.sesion.clinicaId, paciente_id: pacienteId, odontologo_id: d.sesion.usuarioId, texto: "",
  });
  if (error) return fallo(mensaje(error, "ficha.labor", "abrir la labor de hoy"));
  revalidatePath(ruta(pacienteId));
  revalidatePath(`/pacientes/${pacienteId}/evolucion`);
  return { error: null, intento: previo.intento + 1, valores: {} };
}
