import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { SUPERFICIES, type Superficie } from "@/lib/clinico/diagnostico";
import { formatearSoles } from "@/lib/dinero";
import { fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import {
  ESTADOS_COBRO, ESTADOS_ITEM, ESTADOS_PLAN, nombreVersion, totales,
  type EstadoCobro, type EstadoItem, type EstadoPlan,
} from "@/lib/plan/plan";
import { ESPECIALIDADES, type Especialidad } from "@/lib/catalogo/validacion";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { AnularPago, RegistrarPago } from "@/app/caja/formularios";
import { METODOS_PAGO, type MetodoPago } from "@/lib/caja";
import { PestanasPaciente } from "../pestanas";
import { CancelarItem, CopiarPlan, DecisionPlan, NuevaFase, NuevoItem, NuevoPlan, type OpcionesItem } from "./formularios";

export const metadata: Metadata = { title: "Plan de tratamiento – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Plan = {
  id: string; titulo: string; version: number; alternativa: string; grupo_id: string; estado: EstadoPlan;
  presentado_at: string; aceptado_at: string | null; motivo_rechazo: string | null; odontologo_id: string;
};
type Item = {
  id: string; plan_id: string; pieza: number | null; superficies: Superficie[] | null; procedimiento: string;
  cie10: string | null; precio_centimos: number; duracion_minutos: number | null; estado: EstadoItem; fase: number;
  orden: number; motivo_cancelacion: string | null;
};

const COLOR_PLAN: Record<EstadoPlan, string> = {
  propuesto: "bg-amber-50 text-amber-900", aceptado: "bg-teal-50 text-teal-800", en_curso: "bg-teal-50 text-teal-800",
  detenido: "bg-red-50 text-red-800", terminado: "bg-gray-100 text-gray-700", rechazado: "bg-gray-100 text-gray-500",
  reemplazado: "bg-gray-100 text-gray-500",
};
const COLOR_ITEM: Record<EstadoItem, string> = {
  propuesto: "bg-amber-50 text-amber-900", aceptado: "bg-sky-50 text-sky-800", programado: "bg-indigo-50 text-indigo-800",
  realizado: "bg-teal-50 text-teal-800", cancelado: "bg-gray-100 text-gray-500",
};
const ubicacion = (i: Pick<Item, "pieza" | "superficies">) =>
  i.pieza === null ? "—" : `${i.pieza}${i.superficies ? ` (${i.superficies.map((s) => SUPERFICIES[s].toLowerCase()).join(", ")})` : ""}`;

export default async function PlanTratamiento({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ p?: string; diagnostico?: string }>;
}) {
  const { id } = await params;
  const { p, diagnostico } = await searchParams;
  if (!modulos.etapa5 || !UUID.test(id)) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  const supabase = await createClient();

  const [paciente, planesR, equipo] = await Promise.all([
    supabase.from("paciente").select("id, nombres, apellidos, anulado_at").eq("id", id)
      .maybeSingle<{ id: string; nombres: string; apellidos: string; anulado_at: string | null }>(),
    supabase.from("plan_tratamiento")
      .select("id, titulo, version, alternativa, grupo_id, estado, presentado_at, aceptado_at, motivo_rechazo, odontologo_id")
      .eq("paciente_id", id).order("presentado_at", { ascending: false }).returns<Plan[]>(),
    supabase.from("usuario").select("id, nombre, cop").returns<{ id: string; nombre: string; cop: string | null }[]>(),
  ]);
  if (!paciente.data) notFound();
  if (planesR.error) registrarError("plan.lista", planesR.error, { paciente: id });
  const planes = planesR.data ?? [];
  const idsPlanes = planes.map((x) => x.id);
  const [itemsR, cobrosR] = idsPlanes.length > 0 ? await Promise.all([
    supabase.from("item_plan")
      .select("id, plan_id, pieza, superficies, procedimiento, cie10, precio_centimos, duracion_minutos, estado, fase, orden, motivo_cancelacion")
      .in("plan_id", idsPlanes).order("orden").returns<Item[]>(),
    supabase.from("v_item_cobro").select("item_plan_id, cobrado_centimos, estado_cobro").in("plan_id", idsPlanes)
      .returns<{ item_plan_id: string; cobrado_centimos: number; estado_cobro: EstadoCobro }[]>(),
  ]) : [{ data: [] as Item[], error: null }, { data: [], error: null }];
  if (itemsR.error) registrarError("plan.items", itemsR.error, { paciente: id });
  const items = itemsR.data ?? [];
  const cobro = new Map((cobrosR.data ?? []).map((c) => [c.item_plan_id, c]));
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.cop ? `${u.nombre} (COP ${u.cop})` : u.nombre]));

  // Plan en pantalla: el pedido, o el vigente más reciente.
  const vigente = (x: Plan) => !["rechazado", "reemplazado"].includes(x.estado);
  const propuestoReciente = planes.find((x) => x.estado === "propuesto");
  const actual = (p ? planes.find((x) => x.id === p) : undefined)
    ?? (diagnostico ? propuestoReciente : undefined) ?? planes.find(vigente) ?? planes[0];

  const esDentista = sesion.esDentista && !paciente.data.anulado_at;
  const decide = sesion.rol !== "asistente" && !paciente.data.anulado_at;

  const [fasesR, depsR, catalogoR, diagnosticosR] = actual ? await Promise.all([
    supabase.from("plan_fase").select("numero, nombre").eq("plan_id", actual.id).order("numero")
      .returns<{ numero: number; nombre: string }[]>(),
    supabase.from("item_dependencia").select("item_id, requiere_id")
      .in("item_id", items.filter((i) => i.plan_id === actual.id).map((i) => i.id))
      .returns<{ item_id: string; requiere_id: string }[]>(),
    esDentista && actual.estado === "propuesto"
      ? supabase.from("procedimiento").select("id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos")
          .eq("activo", true).order("especialidad").order("nombre")
          .returns<(OpcionesItem["catalogo"][number] & { especialidad: Especialidad })[]>()
      : Promise.resolve({ data: [], error: null }),
    sesion.veClinico
      ? supabase.from("diagnostico").select("id, cie10, tipo, pieza, catalogo_cie10(descripcion)").eq("paciente_id", id)
          .is("anulado_at", null).order("registrado_at", { ascending: false })
          .returns<{ id: string; cie10: string; tipo: string; pieza: number | null; catalogo_cie10: { descripcion: string } | null }[]>()
      : Promise.resolve({ data: [], error: null }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const fases = fasesR.data ?? [];
  const deps = depsR.data ?? [];
  const itemsPlan = actual ? items.filter((i) => i.plan_id === actual.id) : [];
  const numero = new Map(itemsPlan.map((i, n) => [i.id, n + 1]));
  const t = totales(itemsPlan.map((i) => ({ estado: i.estado, precio_centimos: i.precio_centimos, cobrado_centimos: cobro.get(i.id)?.cobrado_centimos ?? 0 })));
  const grupos = [...new Set(planes.map((x) => x.grupo_id))].map((g) => planes.filter((x) => x.grupo_id === g));
  // Etapa 8: pagos del plan (los ve toda la clínica; los registra administración o recepción).
  const pagosR = modulos.etapa8 && actual
    ? await supabase.from("pago").select("id, monto_centimos, metodo, referencia, pagado_at, anulado_at, motivo_anulacion")
        .eq("plan_id", actual.id).order("pagado_at", { ascending: false })
        .returns<{ id: string; monto_centimos: number; metodo: MetodoPago; referencia: string | null; pagado_at: string;
          anulado_at: string | null; motivo_anulacion: string | null }[]>()
    : { data: null, error: null };
  if (pagosR.error) registrarError("plan.pagos", pagosR.error, { paciente: id });
  const pagosPlan = pagosR.data ?? [];
  const pagadoPlan = pagosPlan.filter((x) => !x.anulado_at).reduce((s, x) => s + x.monto_centimos, 0);
  const cobra = (sesion.rol === "admin" || sesion.rol === "recepcion") && !paciente.data.anulado_at;
  const base = `/pacientes/${id}/plan`;
  const conAlternativas = (g: string) => planes.some((x) => x.grupo_id === g && x.alternativa !== "A");

  const opciones: OpcionesItem = {
    catalogo: (catalogoR.data ?? []).map((c) => ({ ...c, especialidad: ESPECIALIDADES[c.especialidad as Especialidad] ?? c.especialidad })),
    fases: fases.length > 0 ? fases : [{ numero: 1, nombre: "Fase 1" }],
    diagnosticos: (diagnosticosR.data ?? []).map((d) => ({
      id: d.id, pieza: d.pieza,
      texto: `${d.cie10} ${d.catalogo_cie10?.descripcion ?? ""}${d.pieza ? ` · pieza ${d.pieza}` : ""} (${d.tipo})`,
    })),
    items: itemsPlan.filter((i) => i.estado !== "cancelado").map((i) => ({ id: i.id, texto: `${numero.get(i.id)}. ${i.procedimiento} ${ubicacion(i)}` })),
  };

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.data.nombres} {paciente.data.apellidos}</h1>
        <PestanasPaciente id={id} actual="plan" veClinico={sesion.veClinico} />

        {planesR.error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar el plan. Recarga la página.</p>}
        {diagnostico && !propuestoReciente && esDentista && (
          <p role="status" className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
            Para agregar el diagnóstico a un plan, primero crea el plan.
          </p>
        )}

        {esDentista && (
          <details open={planes.length === 0 || (!!diagnostico && !propuestoReciente)} className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <summary className="cursor-pointer text-lg font-semibold">Nuevo plan de tratamiento</summary>
            <div className="mt-4">
              <NuevoPlan pacienteId={id} diagnostico={diagnostico && UUID.test(diagnostico) && !propuestoReciente ? diagnostico : undefined} />
            </div>
          </details>
        )}

        {planes.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">Aún no tiene plan de tratamiento.</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
            {/* Planes del paciente, agrupados por propuesta (versiones y alternativas) */}
            <nav aria-label="Planes del paciente" className="flex flex-col gap-3">
              {grupos.map((g) => (
                <div key={g[0]!.grupo_id} className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-sm font-semibold">{g[0]!.titulo}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {[...g].sort((a, b) => b.version - a.version || a.alternativa.localeCompare(b.alternativa)).map((x) => (
                      <li key={x.id}>
                        <Link href={`${base}?p=${x.id}`} aria-current={x.id === actual?.id ? "page" : undefined}
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${x.id === actual?.id ? "bg-teal-50" : "hover:bg-gray-50"}`}>
                          <span>{nombreVersion(x, conAlternativas(x.grupo_id))}</span>
                          <span className={`rounded px-1.5 py-0.5 text-xs ${COLOR_PLAN[x.estado]}`}>{ESTADOS_PLAN[x.estado]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            {actual && (
              <section aria-labelledby="t-plan" className="flex flex-col gap-4">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 id="t-plan" className="text-lg font-semibold">{actual.titulo}</h2>
                      <p className="text-sm text-gray-600">
                        {nombreVersion(actual, conAlternativas(actual.grupo_id))} · presentado el {formatearFecha(fechaLima(actual.presentado_at))}
                        {actual.aceptado_at && ` · aceptado el ${formatearFecha(fechaLima(actual.aceptado_at))}`}
                        {" · "}{autor.get(actual.odontologo_id) ?? "—"}
                      </p>
                      {actual.motivo_rechazo && <p className="mt-1 text-sm text-gray-600">Motivo: {actual.motivo_rechazo}</p>}
                    </div>
                    <span className={`rounded px-2 py-1 text-sm ${COLOR_PLAN[actual.estado]}`}>{ESTADOS_PLAN[actual.estado]}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div><dt className="text-xs uppercase tracking-wide text-gray-500">Total</dt><dd className="font-semibold tabular-nums">{formatearSoles(t.total)}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-gray-500">Realizado</dt><dd className="tabular-nums">{formatearSoles(t.realizado)}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-gray-500">Pagado</dt><dd className="tabular-nums">{formatearSoles(t.pagado)}</dd></div>
                  </dl>
                  {esDentista && ["propuesto", "aceptado", "en_curso", "detenido"].includes(actual.estado) && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <CopiarPlan pacienteId={id} planId={actual.id} alternativa={actual.estado === "propuesto"} />
                      <p className="mt-1 text-xs text-gray-500">
                        La versión nueva reemplaza a esta cuando el paciente la acepta; la alternativa se presenta junto a esta.
                      </p>
                    </div>
                  )}
                </div>

                {/* Ítems por fase */}
                {(fases.length > 0 ? fases : [{ numero: 1, nombre: "Ítems" }]).map((f) => {
                  const enFase = itemsPlan.filter((i) => i.fase === f.numero);
                  return (
                    <div key={f.numero} className="rounded-xl border border-gray-200 bg-white p-5">
                      <h3 className="font-semibold">Fase {f.numero}: {f.nombre}</h3>
                      {enFase.length === 0 ? <p className="mt-2 text-sm text-gray-500">Sin ítems en esta fase.</p> : (
                        <ul className="mt-2 divide-y divide-gray-100">
                          {enFase.map((i) => {
                            const c = cobro.get(i.id);
                            const requiere = deps.filter((d) => d.item_id === i.id).map((d) => numero.get(d.requiere_id)).filter(Boolean);
                            const cancelable = ["propuesto", "aceptado", "programado"].includes(i.estado)
                              && (esDentista || (decide && i.estado === "propuesto"));
                            return (
                              <li key={i.id} data-item={i.id} className={`py-3 ${i.estado === "cancelado" ? "text-gray-400" : ""}`}>
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <p className={i.estado === "cancelado" ? "line-through" : ""}>
                                    <span className="text-gray-500">{numero.get(i.id)}.</span> <span className="font-medium">{i.procedimiento}</span>
                                    {i.pieza !== null && <> · pieza {ubicacion(i)}</>}
                                  </p>
                                  <span className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="tabular-nums">{formatearSoles(i.precio_centimos)}</span>
                                    <span className={`rounded px-1.5 py-0.5 text-xs ${COLOR_ITEM[i.estado]}`}>{ESTADOS_ITEM[i.estado]}</span>
                                    {c && i.estado !== "cancelado" && i.estado !== "propuesto" && (
                                      <span className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-700">{ESTADOS_COBRO[c.estado_cobro]}</span>
                                    )}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs text-gray-500">
                                  {i.duracion_minutos ? `${i.duracion_minutos} min` : ""}
                                  {sesion.veClinico && i.cie10 && ` · Dx ${i.cie10}`}
                                  {requiere.length > 0 && ` · después de ${requiere.map((n) => `#${n}`).join(", ")}`}
                                  {i.motivo_cancelacion && ` · ${i.motivo_cancelacion}`}
                                </p>
                                {cancelable && actual.estado !== "rechazado" && actual.estado !== "reemplazado" && (
                                  <CancelarItem pacienteId={id} id={i.id} descripcion={i.procedimiento} />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {esDentista && actual.estado === "propuesto" && (
                  <div id="agregar-item" className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">Agregar ítem</h3>
                      <NuevaFase pacienteId={id} planId={actual.id} />
                    </div>
                    {catalogoR.error ? <p role="alert" className="text-sm text-red-700">No se pudo cargar el catálogo. Recarga la página.</p> : (
                      <NuevoItem key={`${actual.id}${diagnostico ?? ""}${fases.length}`} pacienteId={id} planId={actual.id} opciones={opciones}
                        diagnosticoInicial={diagnostico && opciones.diagnosticos.some((d) => d.id === diagnostico) ? diagnostico : undefined} />
                    )}
                  </div>
                )}

                {decide && actual.estado === "propuesto" && itemsPlan.some((i) => i.estado === "propuesto") && (
                  <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <h3 className="mb-3 font-semibold">Decisión del paciente</h3>
                    <DecisionPlan pacienteId={id} planId={actual.id}
                      items={itemsPlan.filter((i) => i.estado === "propuesto").map((i) => ({
                        id: i.id, texto: `${numero.get(i.id)}. ${i.procedimiento} ${ubicacion(i)} · ${formatearSoles(i.precio_centimos)}`,
                      }))} />
                  </div>
                )}

                {modulos.etapa8 && ["aceptado", "en_curso", "detenido", "terminado"].includes(actual.estado) && (
                  <div className="rounded-xl border border-gray-200 bg-white p-5" aria-labelledby="t-pagos" role="region">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 id="t-pagos" className="font-semibold">Pagos</h3>
                      <p className="text-sm tabular-nums">
                        Pagado {formatearSoles(pagadoPlan)} · saldo {formatearSoles(Math.max(0, t.total - pagadoPlan))}
                      </p>
                    </div>
                    {pagosPlan.length > 0 && (
                      <ul className="mt-2 divide-y divide-gray-100 text-sm">
                        {pagosPlan.map((x) => (
                          <li key={x.id} data-pago={x.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                            <span className={x.anulado_at ? "text-gray-400 line-through" : ""}>
                              {formatearFecha(fechaLima(x.pagado_at))} · {formatearSoles(x.monto_centimos)} · {METODOS_PAGO[x.metodo]}
                              {x.referencia ? ` · ${x.referencia}` : ""}
                            </span>
                            {x.anulado_at ? <span className="text-xs text-gray-500">Anulado: {x.motivo_anulacion}</span>
                              : cobra && <AnularPago pacienteId={id} id={x.id} descripcion={`el pago de ${formatearSoles(x.monto_centimos)}`} />}
                          </li>
                        ))}
                      </ul>
                    )}
                    {cobra && t.total - pagadoPlan > 0 && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <RegistrarPago pacienteId={id} planId={actual.id} saldo={formatearSoles(t.total - pagadoPlan)} />
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
