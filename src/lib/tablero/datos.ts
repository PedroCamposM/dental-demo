import "server-only";
import { cache } from "react";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { createClient } from "@/lib/supabase/server";
import {
  TIPOS_CONTROL,
  calcularTablero,
  type CitaFila,
  type CuotaFila,
  type DatosTablero,
  type ItemFila,
  type PacienteFila,
  type PlanFila,
  type SeguimientoFila,
  type Tablero,
} from "./calculos";
import type { TipoSeguimiento } from "./mensajes";

// grupo_id llega con la migración 0911 (Etapa 5); antes, las alternativas se agrupan por paciente y día.
const COLUMNAS_PLAN: string = "id, paciente_id, titulo, estado, presentado_at, aceptado_at, fecha_vencimiento"
  + (modulos.etapa5 ? ", grupo_id" : "");

export type Plantilla = { id: string; cuerpo: string };

export type TableroCargado = {
  tablero: Tablero;
  plantillas: Partial<Record<TipoSeguimiento, Plantilla>>;
  /** Último mensaje enviado (ISO) por "tipo|pacienteId", de los últimos 30 días. */
  ultimosEnvios: Record<string, string>;
};

const LOTE = 1000;   // filas máximas por respuesta de la Data API de Supabase

type Respuesta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

// Pide por lotes hasta traer todo (la Data API corta en 1000 filas).
async function todas<T>(consulta: (desde: number, hasta: number) => Respuesta<T>): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += LOTE) {
    const { data, error } = await consulta(desde, desde + LOTE - 1);
    if (error) throw new Error(`No se pudieron cargar los datos del tablero: ${error.message}`);
    filas.push(...(data ?? []));
    if (!data || data.length < LOTE) return filas;
  }
}

/** Carga lo que RLS deja ver de la clínica del usuario y calcula el tablero. */
export const cargarTablero = cache(async (): Promise<TableroCargado> => {
  const supabase = await createClient();
  const ahora = new Date();
  const hoy = fechaLima(ahora);
  const haceUnAnio = new Date(ahora.getTime() - 400 * 86_400_000).toISOString();
  const haceUnMes = new Date(ahora.getTime() - 30 * 86_400_000).toISOString();

  const [pacientes, planes, items, cuotas, citas, seguimientos, plantillas, envios] = await Promise.all([
    todas<PacienteFila>((a, b) => supabase.from("paciente")
      .select("id, nombres, apellidos, telefono, apoderado_nombre, apoderado_telefono")
      .is("anulado_at", null).order("id").range(a, b)),
    todas<PlanFila>((a, b) => supabase.from("plan_tratamiento")
      .select(COLUMNAS_PLAN)
      .order("id").range(a, b).returns<PlanFila[]>()),
    todas<ItemFila>((a, b) => supabase.from("item_plan")
      .select("id, plan_id, estado, precio_centimos").order("id").range(a, b)),
    todas<CuotaFila>((a, b) => supabase.from("v_cuota_saldo")
      .select("cuota_id, plan_id, numero, vence_el, monto_centimos, pagado_centimos")
      .eq("vencida", true).order("cuota_id").range(a, b)),
    todas<Omit<CitaFila, "item_ids"> & { cita_item: { item_plan_id: string }[] }>((a, b) => supabase.from("cita")
      .select("id, paciente_id, inicio, estado, cita_item(item_plan_id)")
      .gte("inicio", haceUnAnio).order("id").range(a, b)),
    todas<SeguimientoFila>((a, b) => supabase.from("seguimiento")
      .select("id, paciente_id, plan_id, tipo, fecha_programada, resultado")
      // Con la Etapa 8, también los controles clínicos (los tipos nuevos existen desde la 0917).
      .in("tipo", modulos.etapa8 ? TIPOS_CONTROL : ["control"]).lt("fecha_programada", hoy).order("id").range(a, b)),
    todas<Plantilla & { tipo: TipoSeguimiento }>((a, b) => supabase.from("plantilla_mensaje")
      .select("id, tipo, cuerpo").eq("activa", true).order("created_at").range(a, b)),
    todas<{ tipo: TipoSeguimiento; paciente_id: string; realizado_at: string }>((a, b) => supabase.from("seguimiento")
      .select("tipo, paciente_id, realizado_at").eq("resultado", "mensaje_enviado")
      .gte("realizado_at", haceUnMes).order("realizado_at").range(a, b)),
  ]);

  const datos: DatosTablero = {
    pacientes, planes, items, cuotas, seguimientos,
    citas: citas.map(({ cita_item, ...c }) => ({ ...c, item_ids: cita_item.map((ci) => ci.item_plan_id) })),
  };

  const porTipo: TableroCargado["plantillas"] = {};
  for (const p of plantillas) porTipo[p.tipo] ??= { id: p.id, cuerpo: p.cuerpo };

  const ultimosEnvios: Record<string, string> = {};
  for (const e of envios) ultimosEnvios[`${e.tipo}|${e.paciente_id}`] = e.realizado_at;   // en orden: queda el último

  return { tablero: calcularTablero(datos, ahora), plantillas: porTipo, ultimosEnvios };
});
