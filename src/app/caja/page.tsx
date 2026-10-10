import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { METODOS_PAGO, type MetodoPago } from "@/lib/caja";
import { formatearSoles } from "@/lib/dinero";
import { fechaLima, formatearFechaLarga, horaLima, sumarDias } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { CerrarCaja, RegistrarAjuste } from "./formularios";

export const metadata: Metadata = { title: "Caja – Dental Demo" };

type Resumen = {
  total_centimos: number; pagos: number; por_metodo: Partial<Record<MetodoPago, number>>;
  por_profesional: { profesional_id: string | null; nombre: string | null; centimos: number }[];
};
type Cierre = {
  id: string; por_metodo: Partial<Record<MetodoPago, number>>; por_profesional: Resumen["por_profesional"];
  total_centimos: number; pagos: number; efectivo_esperado: number; efectivo_contado: number; diferencia_centimos: number;
  observaciones: string | null; cerrado_por: string; cerrado_at: string;
};
type Pago = {
  id: string; monto_centimos: number; metodo: MetodoPago; referencia: string | null; pagado_at: string; anulado_at: string | null;
  plan_tratamiento: { titulo: string; paciente: { id: string; nombres: string; apellidos: string } | null } | null;
};
type Ajuste = { id: string; metodo: MetodoPago; monto_centimos: number; motivo: string; registrado_por: string; registrado_at: string };

function Montos({ porMetodo }: { porMetodo: Partial<Record<MetodoPago, number>> }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {(Object.keys(METODOS_PAGO) as MetodoPago[]).map((m) => (
        <div key={m} className="rounded-lg bg-gray-50 p-2">
          <dt className="text-xs uppercase tracking-wide text-gray-500">{METODOS_PAGO[m]}</dt>
          <dd className="font-semibold tabular-nums">{formatearSoles(porMetodo[m] ?? 0)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Cierre de caja diario: resumen por método y por profesional, efectivo contado y ajustes. */
export default async function Caja({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  if (!modulos.etapa8) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (sesion.rol !== "admin" && sesion.rol !== "recepcion") redirect("/");
  const hoy = fechaLima(new Date());
  const pedida = (await searchParams).fecha ?? "";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pedida) && !Number.isNaN(Date.parse(pedida)) && pedida <= hoy ? pedida : hoy;
  const supabase = await createClient();
  const desde = `${fecha}T00:00:00-05:00`;
  const hasta = `${sumarDias(fecha, 1)}T00:00:00-05:00`;
  const [resumen, cierre, pagos, equipo] = await Promise.all([
    supabase.rpc("resumen_caja", { dia: fecha }),
    supabase.from("cierre_caja").select("*").eq("fecha", fecha).maybeSingle<Cierre>(),
    supabase.from("pago")
      .select("id, monto_centimos, metodo, referencia, pagado_at, anulado_at, plan_tratamiento(titulo, paciente(id, nombres, apellidos))")
      .gte("pagado_at", desde).lt("pagado_at", hasta).order("pagado_at").returns<Pago[]>(),
    supabase.from("usuario").select("id, nombre").returns<{ id: string; nombre: string }[]>(),
  ]);
  const ajustes = cierre.data
    ? await supabase.from("ajuste_caja").select("id, metodo, monto_centimos, motivo, registrado_por, registrado_at")
        .eq("cierre_id", cierre.data.id).order("registrado_at").returns<Ajuste[]>()
    : { data: [] as Ajuste[], error: null };
  const error = resumen.error ?? cierre.error ?? pagos.error ?? ajustes.error;
  if (error) registrarError("caja.ver", error, { fecha });
  const r = (resumen.data ?? { total_centimos: 0, pagos: 0, por_metodo: {}, por_profesional: [] }) as Resumen;
  const c = cierre.data;
  const autor = new Map((equipo.data ?? []).map((u) => [u.id, u.nombre]));
  const totalAjustes = (ajustes.data ?? []).reduce((s, a) => s + a.monto_centimos, 0);

  return (
    <>
      <Encabezado sesion={sesion} seccion="caja" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Caja</h1>
            <p className="text-gray-600"><span className="capitalize">{formatearFechaLarga(fecha)}</span>{fecha === hoy && " · hoy"}</p>
          </div>
          <nav aria-label="Cambiar de día" className="flex items-center gap-1">
            <Link href={`/caja?fecha=${sumarDias(fecha, -1)}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">← Anterior</Link>
            <Link href="/caja" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Hoy</Link>
            {fecha < hoy && (
              <Link href={`/caja?fecha=${sumarDias(fecha, 1)}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Siguiente →</Link>
            )}
          </nav>
        </div>
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar toda la caja. Recarga la página.</p>}

        <section aria-labelledby="t-resumen" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="t-resumen" className="text-lg font-semibold">{c ? "Caja cerrada" : "Resumen del día"}</h2>
            <p className="text-lg font-semibold tabular-nums">{formatearSoles(c ? c.total_centimos : r.total_centimos)}
              <span className="ml-1 text-sm font-normal text-gray-600">({c ? c.pagos : r.pagos} pagos)</span></p>
          </div>
          <div className="mt-3"><Montos porMetodo={c ? c.por_metodo : r.por_metodo} /></div>
          {(c ? c.por_profesional : r.por_profesional).length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700">Por profesional (del plan cobrado)</h3>
              <ul className="mt-1 text-sm">
                {(c ? c.por_profesional : r.por_profesional).map((p) => (
                  <li key={p.profesional_id ?? "—"} className="flex justify-between border-b border-gray-100 py-1">
                    <span>{p.nombre ?? "Sin profesional"}</span><span className="tabular-nums">{formatearSoles(p.centimos)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c ? (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
              <p>Efectivo esperado {formatearSoles(c.efectivo_esperado)} · contado {formatearSoles(c.efectivo_contado)} ·{" "}
                <b className={c.diferencia_centimos === 0 ? "text-teal-800" : "text-red-700"}>
                  diferencia {formatearSoles(c.diferencia_centimos)}</b></p>
              {c.observaciones && <p className="mt-1">Observaciones: {c.observaciones}</p>}
              <p className="mt-1 text-gray-600">Cerró {autor.get(c.cerrado_por) ?? "—"} a las {horaLima(c.cerrado_at)} del {fechaLima(c.cerrado_at)}.</p>
            </div>
          ) : (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <CerrarCaja fecha={fecha} esperado={formatearSoles(r.por_metodo.efectivo ?? 0)} />
            </div>
          )}
        </section>

        {c && (
          <section aria-labelledby="t-ajustes" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-ajustes" className="text-lg font-semibold">Ajustes posteriores al cierre</h2>
            <p className="text-sm text-gray-600">Los pagos de un día cerrado no se editan: se corrigen con un ajuste con motivo.</p>
            {(ajustes.data ?? []).length > 0 && (
              <ul className="mt-2 text-sm">
                {(ajustes.data ?? []).map((a) => (
                  <li key={a.id} className="border-b border-gray-100 py-1">
                    <span className="tabular-nums font-medium">{formatearSoles(a.monto_centimos)}</span> · {METODOS_PAGO[a.metodo]} · {a.motivo}
                    <span className="text-gray-500"> · {autor.get(a.registrado_por) ?? "—"}, {fechaLima(a.registrado_at)} {horaLima(a.registrado_at)}</span>
                  </li>
                ))}
                <li className="pt-1 font-medium">Total de ajustes: {formatearSoles(totalAjustes)}</li>
              </ul>
            )}
            <div className="mt-3"><RegistrarAjuste cierreId={c.id} /></div>
          </section>
        )}

        <section aria-labelledby="t-pagos" className="mt-6">
          <h2 id="t-pagos" className="text-lg font-semibold">Pagos del día</h2>
          {(pagos.data ?? []).length === 0 ? <p className="mt-2 text-sm text-gray-500">No hay pagos registrados este día.</p> : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm">
              {(pagos.data ?? []).map((p) => (
                <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 ${p.anulado_at ? "text-gray-400 line-through" : ""}`}>
                  <span>
                    {horaLima(p.pagado_at)} ·{" "}
                    {p.plan_tratamiento?.paciente ? (
                      <Link href={`/pacientes/${p.plan_tratamiento.paciente.id}/plan`} className="text-teal-800 hover:underline">
                        {p.plan_tratamiento.paciente.apellidos}, {p.plan_tratamiento.paciente.nombres}
                      </Link>
                    ) : "Paciente"} · {p.plan_tratamiento?.titulo}
                  </span>
                  <span className="tabular-nums">{formatearSoles(p.monto_centimos)} · {METODOS_PAGO[p.metodo]}{p.referencia ? ` · ${p.referencia}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
