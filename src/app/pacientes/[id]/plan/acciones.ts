"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { modulos } from "@/lib/funciones";
import { validarItems, type CampoItem, type DiagnosticoVigente, type ProcedimientoCatalogo } from "@/lib/plan/plan";
import { registrarError } from "@/lib/registro";
import { obtenerSesion, type Sesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Permiso = "dentista" | "decision";
/** «dentista»: arma el plan. «decision»: registra lo que decide el paciente (recepción o dentista). */
async function permitir(pacienteId: string, permiso: Permiso): Promise<{ error: string } | { error: null; sesion: Sesion }> {
  if (!modulos.etapa5) return { error: "Este módulo aún no está habilitado." };
  if (!UUID.test(pacienteId)) return { error: "Paciente inválido." };
  const sesion = await obtenerSesion();
  if (!sesion) return { error: "Tu sesión terminó. Vuelve a ingresar." };
  if (permiso === "dentista" && !sesion.esDentista) return { error: "Solo el cirujano dentista arma el plan de tratamiento." };
  if (permiso === "decision" && sesion.rol === "asistente") return { error: "Tu rol no registra la decisión del paciente." };
  return { error: null, sesion };
}

/** Mensaje para el usuario a partir de un error de la base (nunca el error técnico). */
function mensaje(error: { code?: string; message: string }, contexto: string, que: string): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Tu rol no puede hacer este cambio.";
  registrarError(contexto, error);
  return `No se pudo ${que}. Inténtalo de nuevo.`;
}

/** El plan es de este paciente y está en el estado esperado. */
async function planDe(pacienteId: string, planId: string, estados: string[]) {
  if (!UUID.test(planId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("plan_tratamiento").select("id, estado")
    .eq("id", planId).eq("paciente_id", pacienteId).maybeSingle<{ id: string; estado: string }>();
  return data && estados.includes(data.estado) ? data : null;
}

export type EstadoSimple = { error: string | null; intento: number; valores: Record<string, string> };

// ---------------------------------------------------------------------------
// Nuevo plan
// ---------------------------------------------------------------------------
export async function crearPlan(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const valores = { titulo: String(form.get("titulo") ?? "").trim(), fase: String(form.get("fase") ?? "").trim() };
  const diagnostico = String(form.get("diagnostico") ?? "");
  const fallo = (error: string): EstadoSimple => ({ error, intento: previo.intento + 1, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const p = await permitir(pacienteId, "dentista");
  if (p.error !== null) return fallo(p.error);
  if (valores.titulo.length < 3 || valores.titulo.length > 120) return fallo("Escribe el título del plan (3 a 120 caracteres).");
  if (valores.fase.length < 2 || valores.fase.length > 80) return fallo("Escribe el nombre de la primera fase.");

  const supabase = await createClient();
  const { data: plan, error } = await supabase.from("plan_tratamiento").insert({
    clinica_id: p.sesion.clinicaId, paciente_id: pacienteId, odontologo_id: p.sesion.usuarioId, titulo: valores.titulo,
  }).select("id").single<{ id: string }>();
  if (error || !plan) return fallo(error ? mensaje(error, "plan.crear", "crear el plan") : "No se pudo crear el plan.");
  const { error: errorFase } = await supabase.from("plan_fase").insert({
    clinica_id: p.sesion.clinicaId, plan_id: plan.id, numero: 1, nombre: valores.fase,
  });
  if (errorFase) registrarError("plan.fase", errorFase, { plan: plan.id });
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  // Si venía de «Agregar al plan», el diagnóstico sigue elegido en el formulario del ítem.
  redirect(`/pacientes/${pacienteId}/plan?p=${plan.id}${UUID.test(diagnostico) ? `&diagnostico=${diagnostico}#agregar-item` : ""}`);
}

export async function agregarFase(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const valores = { nombre: String(form.get("nombre") ?? "").trim() };
  const fallo = (error: string): EstadoSimple => ({ error, intento: previo.intento + 1, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const planId = String(form.get("plan_id") ?? "");
  const p = await permitir(pacienteId, "dentista");
  if (p.error !== null) return fallo(p.error);
  if (!(await planDe(pacienteId, planId, ["propuesto"]))) return fallo("Solo se modifica un plan propuesto. Crea una versión nueva.");
  if (valores.nombre.length < 2 || valores.nombre.length > 80) return fallo("Escribe el nombre de la fase.");
  const supabase = await createClient();
  const { data: fases } = await supabase.from("plan_fase").select("numero").eq("plan_id", planId).returns<{ numero: number }[]>();
  const numero = Math.max(0, ...(fases ?? []).map((f) => f.numero)) + 1;
  if (numero > 9) return fallo("Un plan tiene como máximo 9 fases.");
  const { error } = await supabase.from("plan_fase").insert({ clinica_id: p.sesion.clinicaId, plan_id: planId, numero, nombre: valores.nombre });
  if (error) return fallo(mensaje(error, "plan.fase", "agregar la fase"));
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  return { error: null, intento: previo.intento + 1, valores: {} };
}

// ---------------------------------------------------------------------------
// Ítems
// ---------------------------------------------------------------------------
export type EstadoItemForm = {
  /** `exitos` cambia solo al agregar: el formulario se vacía (también el procedimiento elegido). */
  errores: Partial<Record<CampoItem | "general", string>>; mensaje: string | null; intento: number; exitos: number;
  valores: { textos: Record<string, string>; superficies: string[]; requiere: string[] };
};

export async function agregarItem(previo: EstadoItemForm, form: FormData): Promise<EstadoItemForm> {
  const intento = previo.intento + 1;
  const valores = {
    textos: Object.fromEntries(["procedimiento_id", "precio", "duracion_minutos", "pieza", "fase", "diagnostico_id"]
      .map((c) => [c, String(form.get(c) ?? "")])),
    superficies: form.getAll("superficies").map(String),
    requiere: form.getAll("requiere").map(String),
  };
  const fallo = (errores: EstadoItemForm["errores"]): EstadoItemForm => ({ errores, mensaje: null, intento, exitos: previo.exitos, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const planId = String(form.get("plan_id") ?? "");
  const p = await permitir(pacienteId, "dentista");
  if (p.error !== null) return fallo({ general: p.error });
  if (!(await planDe(pacienteId, planId, ["propuesto"]))) {
    return fallo({ general: "Solo se agregan ítems a un plan propuesto. Para cambiar uno aceptado, crea una versión nueva." });
  }

  const supabase = await createClient();
  const [catalogo, fases, diagnosticos, items] = await Promise.all([
    supabase.from("procedimiento").select("id, codigo, nombre, precio_base_centimos, duracion_minutos").eq("activo", true)
      .returns<ProcedimientoCatalogo[]>(),
    supabase.from("plan_fase").select("numero").eq("plan_id", planId).returns<{ numero: number }[]>(),
    supabase.from("diagnostico").select("id, pieza, cie10").eq("paciente_id", pacienteId).is("anulado_at", null)
      .returns<DiagnosticoVigente[]>(),
    supabase.from("item_plan").select("id, orden").eq("plan_id", planId).returns<{ id: string; orden: number }[]>(),
  ]);
  if (catalogo.error || fases.error || items.error) {
    registrarError("plan.item.contexto", catalogo.error ?? fases.error ?? items.error);
    return fallo({ general: "No se pudo cargar el catálogo. Inténtalo de nuevo." });
  }
  const numerosFase = (fases.data ?? []).map((f) => f.numero);
  const r = validarItems(
    { texto: (c) => valores.textos[c] ?? "", lista: (c) => (c === "superficies" ? valores.superficies : valores.requiere) },
    {
      catalogo: catalogo.data ?? [], fases: numerosFase.length > 0 ? numerosFase : [1],
      diagnosticos: diagnosticos.data ?? [], items: (items.data ?? []).map((i) => i.id),
    },
  );
  if (!r.ok) return fallo(r.errores);
  const requiere = r.datos[0]?.requiere ?? [];
  const orden = Math.max(0, ...(items.data ?? []).map((i) => i.orden));
  // Un solo envío: o se agregan todas las piezas o ninguna.
  const { data: nuevos, error } = await supabase.from("item_plan").insert(r.datos.map(({ requiere: _r, ...datos }, n) => {
    void _r;
    return { ...datos, clinica_id: p.sesion.clinicaId, plan_id: planId, odontologo_id: p.sesion.usuarioId, orden: orden + n + 1 };
  })).select("id").returns<{ id: string }[]>();
  if (error || !nuevos?.length) return fallo({ general: error ? mensaje(error, "plan.item", "agregar el ítem") : "No se pudo agregar el ítem." });
  if (requiere.length > 0) {
    const { error: errorDep } = await supabase.from("item_dependencia").insert(nuevos.flatMap((item) =>
      requiere.map((req) => ({ clinica_id: p.sesion.clinicaId, item_id: item.id, requiere_id: req }))));
    if (errorDep) {
      revalidatePath(`/pacientes/${pacienteId}/plan`);
      // Los ítems ya quedaron: el formulario se limpia para no duplicarlos al reintentar.
      const que = nuevos.length > 1 ? `Se agregaron los ${nuevos.length} ítems` : "Se agregó el ítem";
      return {
        errores: { general: `${que}, pero no su orden: ${mensaje(errorDep, "plan.dependencia", "guardar el orden")}` },
        mensaje: null, intento, exitos: previo.exitos + 1, valores: { textos: { fase: valores.textos.fase ?? "1" }, superficies: [], requiere: [] },
      };
    }
  }
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  const nombre = r.datos[0]?.procedimiento ?? "";
  let texto = r.datos.length > 1
    ? `Agregados ${r.datos.length} ítems: ${nombre} en las piezas ${r.datos.map((d) => d.pieza).join(", ")}.`
    : `Agregado: ${nombre}.`;
  const sinDx = valores.textos.diagnostico_id ? r.datos.filter((d) => d.diagnostico_id === null) : [];
  if (sinDx.length > 0) {
    texto += ` Sin diagnóstico de origen (no hay uno con ese CIE-10 en la pieza): ${sinDx.map((d) => d.pieza ?? "—").join(", ")}.`;
  }
  return { errores: {}, mensaje: texto, intento, exitos: previo.exitos + 1, valores: { textos: { fase: valores.textos.fase ?? "1" }, superficies: [], requiere: [] } };
}

export async function cancelarItem(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const valores = { motivo: String(form.get("motivo") ?? "").trim() };
  const fallo = (error: string): EstadoSimple => ({ error, intento: previo.intento + 1, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const id = String(form.get("id") ?? "");
  const p = await permitir(pacienteId, "decision");
  if (p.error !== null) return fallo(p.error);
  if (!UUID.test(id)) return fallo("Ítem inválido.");
  if (valores.motivo.length < 3) return fallo("Escribe por qué se cancela.");
  const supabase = await createClient();
  const { data: planes } = await supabase.from("plan_tratamiento").select("id").eq("paciente_id", pacienteId).returns<{ id: string }[]>();
  const { data, error } = await supabase.from("item_plan")
    .update({ estado: "cancelado", motivo_cancelacion: valores.motivo })
    .eq("id", id).in("plan_id", (planes ?? []).map((x) => x.id)).in("estado", ["propuesto", "aceptado", "programado"])
    .select("id").maybeSingle();
  if (error || !data) return fallo(error ? mensaje(error, "plan.cancelar", "cancelar el ítem") : "No se pudo cancelar el ítem. Recarga la página.");
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  return { error: null, intento: previo.intento + 1, valores: {} };
}

// ---------------------------------------------------------------------------
// Decisión del paciente y versiones
// ---------------------------------------------------------------------------
export async function aceptarPlan(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const planId = String(form.get("plan_id") ?? "");
  const parcial = form.get("parcial") === "1";
  const items = form.getAll("items").map(String);
  // La selección vuelve en `valores` para no perderla si hay que corregir algo.
  const fallo = (error: string): EstadoSimple => ({
    error, intento: previo.intento + 1, valores: { parcial: parcial ? "1" : "", items: items.join(",") },
  });
  const p = await permitir(pacienteId, "decision");
  if (p.error !== null) return fallo(p.error);
  if (!(await planDe(pacienteId, planId, ["propuesto"]))) return fallo("Este plan ya no está propuesto. Recarga la página.");
  if (parcial && items.length === 0) return fallo("Marca los ítems que el paciente acepta.");
  if (items.some((i) => !UUID.test(i))) return fallo("Ítems inválidos. Recarga la página.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("aceptar_plan", { id_plan: planId, items: parcial ? items : null });
  if (error) return fallo(mensaje(error, "plan.aceptar", "registrar la aceptación"));
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  return { error: null, intento: previo.intento + 1, valores: {} };
}

export async function rechazarPlan(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const valores = { motivo: String(form.get("motivo") ?? "").trim() };
  const fallo = (error: string): EstadoSimple => ({ error, intento: previo.intento + 1, valores });
  const pacienteId = String(form.get("paciente_id") ?? "");
  const planId = String(form.get("plan_id") ?? "");
  const p = await permitir(pacienteId, "decision");
  if (p.error !== null) return fallo(p.error);
  if (valores.motivo.length < 3) return fallo("Escribe el motivo que dio el paciente.");
  if (!(await planDe(pacienteId, planId, ["propuesto"]))) return fallo("Este plan ya no está propuesto. Recarga la página.");
  const supabase = await createClient();
  // En una sola transacción: el plan y sus ítems propuestos.
  const { error } = await supabase.rpc("rechazar_plan", { id_plan: planId, motivo: valores.motivo });
  if (error) return fallo(mensaje(error, "plan.rechazar", "registrar el rechazo"));
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  return { error: null, intento: previo.intento + 1, valores: {} };
}

export async function copiarPlan(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  const pacienteId = String(form.get("paciente_id") ?? "");
  const planId = String(form.get("plan_id") ?? "");
  const como = String(form.get("como") ?? "");
  const fallo = (error: string): EstadoSimple => ({ error, intento: previo.intento + 1, valores: {} });
  const p = await permitir(pacienteId, "dentista");
  if (p.error !== null) return fallo(p.error);
  if (como !== "version" && como !== "alternativa") return fallo("Indica si es una versión o una alternativa.");
  if (!(await planDe(pacienteId, planId, ["propuesto", "aceptado", "en_curso", "detenido"]))) {
    return fallo("Este plan ya no se puede copiar. Recarga la página.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copiar_plan", { id_plan: planId, como });
  if (error || typeof data !== "string") {
    return fallo(error ? mensaje(error, "plan.copiar", "crear la copia") : "No se pudo crear la copia.");
  }
  revalidatePath(`/pacientes/${pacienteId}/plan`);
  redirect(`/pacientes/${pacienteId}/plan?p=${data}`);
}
