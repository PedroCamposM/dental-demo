import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cerrarSesion } from "@/app/login/actions";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { estadoPlan, type PlanClinica } from "@/lib/prueba";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { formatearSoles } from "@/lib/dinero";
import { NOMBRE_METODO, NOMBRE_PERIODO, type MetodoSuscripcion, type Periodo, type Tarifa } from "@/lib/suscripcion";
import {
  cobranza, conversion, diasHasta, filtrarClientes, NOMBRE_ESTADO, NOMBRE_SALUD, salud, type FilaCliente,
} from "@/lib/gestion";
import { FormularioPlan } from "./formulario";
import { COLOR_SALUD, Contacto } from "./contacto";
import { EditarCobro, EditarTarifa, RevisarPago } from "./suscripcion";
import { NuevoAviso, RetirarAviso } from "./herramientas";
import { PASOS_ACTIVACION } from "@/lib/plataforma";

export const metadata: Metadata = { title: "Plataforma – Dental Demo" };

type Fila = {
  id: string; nombre: string; plan: PlanClinica; prueba_hasta: string | null; activo_hasta: string | null; creada: string;
  usuarios: number; pacientes: number; administrador: string | null; tarifa?: string | null; odontologos?: number;
} & FilaCliente;
type Resumen = {
  ingreso_mensual_centimos: number; en_prueba: number; activas: number; vencidas: number; vencen_7: number;
  pruebas_total: number; pruebas_pagadas: number; vencieron_mes: number; suspendidas?: number;
};
type Aviso = { id: string; clinica_id: string | null; clinica: string | null; texto: string; nivel: "info" | "importante";
  hasta: string; creado_at: string; vigente: boolean };

type PagoPendiente = {
  id: string; clinica_id: string; clinica: string; tarifa: string; periodo: Periodo; monto_centimos: number; metodo: MetodoSuscripcion;
  operacion: string; pagado_el: string; constancia_ruta: string | null; odontologos: number;
};

/** Soles para un campo editable (sin el «S/»). */
const soles = (c: number) => (c / 100).toFixed(2);

const NOMBRE_PLAN: Record<PlanClinica, string> = { demo: "Demostración", prueba: "Prueba", activo: "Activo" };

/** Panel del superadministrador: clínicas registradas y activación manual del plan. */
export default async function Plataforma({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; salud?: string }> }) {
  if (!modulos.etapa16) notFound();
  const supabase = await createClient();
  const { data: esSuper } = await supabase.rpc("es_superadmin");
  if (esSuper !== true) notFound();
  const { data, error } = await supabase.rpc("clinicas_plataforma");
  const filas = (data ?? []) as Fila[];
  if (error) registrarError("plataforma.clinicas", error);
  const [pendientesR, tarifasR, cobroR] = modulos.etapa17
    ? await Promise.all([supabase.rpc("pagos_por_confirmar"), supabase.rpc("tarifas"), supabase.rpc("datos_cobro")])
    : [null, null, null];
  for (const r of [pendientesR, tarifasR, cobroR]) if (r?.error) registrarError("plataforma.suscripcion", r.error);
  const pendientes = (pendientesR?.data ?? []) as PagoPendiente[];
  const tarifas = (tarifasR?.data ?? []) as Tarifa[];
  const cobro = ((cobroR?.data ?? []) as Record<string, string | null>[])[0] ?? {};
  const nombreTarifa = (c: string | null | undefined) => tarifas.find((t) => t.codigo === c)?.nombre ?? c ?? "—";
  const excede = (t: string | null | undefined, n: number) => {
    const max = tarifas.find((x) => x.codigo === t)?.max_odontologos;
    return typeof max === "number" && n > max;
  };
  // Constancias: URL firmada de corta duración (bucket privado).
  const enlaces = new Map<string, string>();
  await Promise.all(pendientes.filter((p) => p.constancia_ruta).map(async (p) => {
    const { data: url } = await supabase.storage.from("suscripcion").createSignedUrl(p.constancia_ruta!, 600);
    if (url?.signedUrl) enlaces.set(p.id, url.signedUrl);
  }));
  const hoy = fechaLima(new Date());
  const ahora = new Date();
  const filtro = await searchParams;
  const resumenR = modulos.etapa18 ? await supabase.rpc("resumen_plataforma") : null;
  if (resumenR?.error) registrarError("plataforma.resumen", resumenR.error);
  const resumen = ((resumenR?.data ?? []) as Resumen[])[0] ?? null;
  const visibles = modulos.etapa18 ? filtrarClientes(filas, filtro, hoy, ahora) as Fila[] : filas;
  const porCobrar = modulos.etapa18 ? cobranza(filas, hoy) : [];
  const conv = resumen ? conversion(resumen.pruebas_pagadas, resumen.pruebas_total) : null;
  const enUnMes = fechaLima(new Date(Date.now() + 31 * 86_400_000));
  const avisosR = modulos.etapa20 ? await supabase.rpc("avisos_plataforma") : null;
  if (avisosR?.error) registrarError("plataforma.avisos", avisosR.error);
  const avisos = ((avisosR?.data ?? []) as Aviso[]).filter((a) => a.vigente);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clínicas de la plataforma</h1>
        <div className="flex flex-wrap items-center gap-2">
          {modulos.etapa20 && (
            <>
              <Link href="/plataforma/ingresos" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Ingresos</Link>
              <Link href="/plataforma/bitacora" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Bitácora</Link>
            </>
          )}
          <form action={cerrarSesion}>
            <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Cerrar sesión</button>
          </form>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-600">Activa el plan al confirmar el pago. Cada cambio queda en la auditoría de la clínica con su motivo.</p>
      {resumen && (
        <section aria-labelledby="t-resumen" className="mt-6">
          <h2 id="t-resumen" className="sr-only">Resumen del negocio</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ["Ingreso mensual", formatearSoles(Number(resumen.ingreso_mensual_centimos))],
              ["En prueba", String(resumen.en_prueba)],
              ["Activas (pagando)", String(resumen.activas)],
              ["Vencidas", String(resumen.vencidas)],
              ["Vencen en 7 días", String(resumen.vencen_7)],
              ["Conversión prueba → pago", conv === null ? "—" : `${conv} % (${resumen.pruebas_pagadas} de ${resumen.pruebas_total})`],
              ["Vencieron este mes", String(resumen.vencieron_mes)],
              ...(modulos.etapa20 ? [["Suspendidas", String(resumen.suspendidas ?? 0)] as const] : []),
            ] as const).map(([t, v]) => (
              <div key={t} className="rounded-xl border border-gray-200 bg-white p-3">
                <dt className="text-xs text-gray-600">{t}</dt>
                <dd className="text-xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {modulos.etapa18 && (
        <section aria-labelledby="t-cobranza" className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 id="t-cobranza" className="text-lg font-semibold">Por contactar ({porCobrar.length})</h2>
          {porCobrar.length === 0 ? <p className="mt-1 text-sm text-gray-600">Nadie por contactar hoy.</p> : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-600"><tr>
                  <th className="py-1 pr-3 font-medium">Clínica</th><th className="py-1 pr-3 font-medium">Situación</th>
                  <th className="py-1 font-medium">Contacto</th>
                </tr></thead>
                <tbody>
                  {porCobrar.map((c) => (
                    <tr key={c.fila.id} className="border-t border-gray-100">
                      <td className="py-2 pr-3"><Link href={`/plataforma/clinicas/${c.fila.id}`} className="font-medium text-teal-700 hover:underline">{c.fila.nombre}</Link></td>
                      <td className="py-2 pr-3">
                        {c.motivo === "vence_pronto" && (c.dias === 0 ? "Vence hoy" : `Vence en ${c.dias} día${c.dias === 1 ? "" : "s"}`)}
                        {c.motivo === "vencido" && `Venció hace ${c.dias} día${c.dias === 1 ? "" : "s"}`}
                        {c.fila.plan === "prueba" ? " (prueba)" : ""}
                        {c.pagoRechazado && " · último pago rechazado"}
                      </td>
                      <td className="py-2"><Contacto fila={c.fila} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {modulos.etapa17 && (
        <section aria-labelledby="t-pendientes" className="mt-6">
          <h2 id="t-pendientes" className="text-lg font-semibold">Pagos por confirmar ({pendientes.length})</h2>
          <p className="text-sm text-gray-600">Revisa que el pago esté en tu cuenta antes de confirmarlo.</p>
          {pendientes.length === 0 ? <p className="mt-2 text-sm text-gray-600">No hay pagos por confirmar.</p> : (
            <ul className="mt-3 flex flex-col gap-3">
              {pendientes.map((p) => {
                const ficha = filas.find((c) => c.id === p.clinica_id);
                const sinFin = ficha?.plan === "activo" && !ficha.activo_hasta;
                const desc = `el pago de ${p.clinica} (${formatearSoles(p.monto_centimos)}, ${NOMBRE_METODO[p.metodo]} ${p.operacion})`
                  + (sinFin ? ". Hoy no tiene fecha de fin: al confirmar, pasa a tener una" : "");
                return (
                  <li key={p.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-medium">{p.clinica}</p>
                    <p className="text-sm text-gray-700">
                      {nombreTarifa(p.tarifa)} {NOMBRE_PERIODO[p.periodo].toLowerCase()} · {formatearSoles(p.monto_centimos)} ·{" "}
                      {NOMBRE_METODO[p.metodo]} n.º {p.operacion} · pagado el {p.pagado_el} · {p.odontologos} odontólogo(s)
                      {excede(p.tarifa, p.odontologos) && <strong className="text-red-700"> · tiene más odontólogos que su plan</strong>}
                      {sinFin && <strong> · hoy activa sin fecha de fin</strong>}
                      {enlaces.has(p.id) && <> · <a href={enlaces.get(p.id)} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-teal-700 hover:underline">Ver constancia</a></>}
                    </p>
                    <div className="mt-3"><RevisarPago pagoId={p.id} descripcion={desc} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {modulos.etapa20 && (
        <section aria-labelledby="t-avisos" className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 id="t-avisos" className="text-lg font-semibold">Avisos a las clínicas</h2>
          <p className="mb-3 text-sm text-gray-600">Se muestran arriba de cada pantalla a todo el personal, hasta la fecha que elijas.</p>
          {avisos.length > 0 && (
            <ul className="mb-4 flex flex-col divide-y divide-gray-100 text-sm">
              {avisos.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${a.nivel === "importante" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"}`}>
                      {a.nivel === "importante" ? "Importante" : "Informativo"}
                    </span>
                    {a.texto} <span className="text-gray-500">· {a.clinica ?? "Todas las clínicas"} · hasta {a.hasta}</span>
                  </span>
                  <RetirarAviso avisoId={a.id} />
                </li>
              ))}
            </ul>
          )}
          <NuevoAviso clinicas={filas.filter((c) => c.plan !== "demo").map((c) => ({ id: c.id, nombre: c.nombre }))}
            hastaSugerido={fechaLima(new Date(Date.now() + 7 * 86_400_000))} />
        </section>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">No se pudo cargar la lista de clínicas.</p>}
      <h2 className="mt-8 text-lg font-semibold">Clínicas{modulos.etapa18 && ` (${visibles.length} de ${filas.length})`}</h2>
      {modulos.etapa18 && (
        <form role="search" aria-label="Buscar clínicas" className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
            Buscar
            <input name="q" defaultValue={filtro.q ?? ""} placeholder="Clínica, administrador o correo"
              className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
            Estado
            <select name="estado" defaultValue={filtro.estado ?? ""} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              {(["prueba", "activo", "vencido", ...(modulos.etapa20 ? ["suspendida"] as const : []), "demo"] as const).map((e) => <option key={e} value={e}>{NOMBRE_ESTADO[e]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
            Salud
            <select name="salud" defaultValue={filtro.salud ?? ""} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">Todas</option>
              {(["verde", "ambar", "rojo", "sin_datos"] as const).map((s) => <option key={s} value={s}>{NOMBRE_SALUD[s]}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">Filtrar</button>
          {(filtro.q || filtro.estado || filtro.salud) && <Link href="/plataforma" className="py-1.5 text-sm text-gray-600 hover:underline">Quitar filtros</Link>}
        </form>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {visibles.map((c) => {
          const est = estadoPlan(c, hoy);
          const s = salud(c.ultima_actividad ?? null, c.actividad_30 ?? 0, c.actividad_previa_30 ?? 0, ahora);
          const hasta = c.plan === "prueba" ? c.prueba_hasta : c.plan === "activo" ? c.activo_hasta : null;
          return (
            <li key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {modulos.etapa18 ? <Link href={`/plataforma/clinicas/${c.id}`} className="hover:underline">{c.nombre}</Link> : c.nombre}
                  {modulos.etapa18 && c.plan !== "demo" && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_SALUD[s]}`}>{NOMBRE_SALUD[s]}</span>
                  )}
                  {modulos.etapa20 && c.suspendida_at && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">Suspendida</span>
                  )}
                  {modulos.etapa20 && c.descuento_pct ? (
                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">−{c.descuento_pct} %</span>
                  ) : null}
                </h2>
                <p className={`text-sm ${est.soloLectura ? "font-medium text-red-700" : "text-gray-600"}`}>
                  {NOMBRE_PLAN[c.plan]}{hasta ? ` hasta ${hasta}` : ""}{est.soloLectura ? " · solo lectura" : ""}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Desde {c.creada} · {c.usuarios} usuario(s) · {c.pacientes} paciente(s) · Administrador: {c.administrador ?? "—"}
                {modulos.etapa17 && <> · {c.odontologos ?? 0} odontólogo(s) · Tarifa: {nombreTarifa(c.tarifa)}
                  {excede(c.tarifa, c.odontologos ?? 0) && <strong className="text-red-700"> (supera su plan)</strong>}</>}
                {modulos.etapa18 && <> · Última actividad: {c.ultima_actividad ? `hace ${Math.max(0, -diasHasta(fechaLima(c.ultima_actividad), hoy))} día(s)` : "—"}</>}
                {modulos.etapa20 && c.plan !== "demo" && <> · Activación: {c.activacion ?? 0} de {PASOS_ACTIVACION.length}</>}
              </p>
              {modulos.etapa18 && (
                <Link href={`/plataforma/clinicas/${c.id}`} aria-label={`Ver ficha de ${c.nombre}`}
                  className="mt-2 inline-block rounded-md border border-teal-700 px-3 py-1 text-sm font-medium text-teal-800 hover:bg-teal-50">
                  Ver ficha →
                </Link>
              )}
              {c.plan !== "demo" && (
                <div className="mt-3"><FormularioPlan clinicaId={c.id} nombre={c.nombre} hastaSugerido={enUnMes} /></div>
              )}
            </li>
          );
        })}
      </ul>
      {modulos.etapa17 && (
        <>
          <section aria-labelledby="t-tarifas" className="mt-8 rounded-xl border border-gray-200 bg-white p-4">
            <h2 id="t-tarifas" className="mb-3 text-lg font-semibold">Precios</h2>
            <div className="flex flex-col gap-3">
              {tarifas.map((t) => (
                <EditarTarifa key={t.codigo} codigo={t.codigo} nombre={t.nombre}
                  mensual={soles(t.mensual_centimos)} anual={soles(t.anual_centimos)} />
              ))}
            </div>
          </section>
          <section aria-labelledby="t-cobro" className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
            <h2 id="t-cobro" className="mb-1 text-lg font-semibold">Datos de cobro</h2>
            <p className="mb-3 text-sm text-gray-600">Los ve el administrador de cada clínica en «Plan y pagos».</p>
            <EditarCobro valores={Object.fromEntries(Object.entries(cobro).map(([k, v]) => [k, v ?? ""]))} />
          </section>
        </>
      )}
    </main>
  );
}
