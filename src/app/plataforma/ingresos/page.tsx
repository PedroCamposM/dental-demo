import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatearSoles } from "@/lib/dinero";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { rangoIngresos, totalesPorMes, type Ingreso } from "@/lib/plataforma";
import { registrarError } from "@/lib/registro";
import { NOMBRE_METODO, NOMBRE_PERIODO, type MetodoSuscripcion } from "@/lib/suscripcion";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ingresos – Dental Demo" };

const ENTRADA = "rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

/** Reporte de ingresos del superadministrador: pagos confirmados por mes, descargable en CSV. */
export default async function Ingresos({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  if (!modulos.etapa20) notFound();
  const supabase = await createClient();
  const { data: esSuper } = await supabase.rpc("es_superadmin");
  if (esSuper !== true) notFound();
  const { desde, hasta } = rangoIngresos(await searchParams, fechaLima(new Date()));
  const { data, error } = await supabase.rpc("ingresos_plataforma", { desde, hasta });
  if (error && !error.message.startsWith("El rango")) registrarError("plataforma.ingresos", error);
  const filas = (data ?? []) as Ingreso[];
  const meses = totalesPorMes(filas);
  const total = filas.reduce((t, f) => t + f.monto_centimos, 0);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/plataforma" className="text-sm text-teal-700 hover:underline">← Clínicas de la plataforma</Link>
      <h1 className="mt-2 text-2xl font-semibold">Ingresos</h1>
      <p className="text-sm text-gray-600">Pagos confirmados, por fecha de confirmación (hora de Lima). Sin comprobantes SUNAT: se emiten por fuera.</p>
      <form className="mt-4 flex flex-wrap items-end gap-2" aria-label="Rango de fechas">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">Desde
          <input type="date" name="desde" defaultValue={desde} className={ENTRADA} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">Hasta
          <input type="date" name="hasta" defaultValue={hasta} className={ENTRADA} /></label>
        <button type="submit" className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">Ver</button>
        <a href={`/plataforma/ingresos/csv?desde=${desde}&hasta=${hasta}`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Descargar CSV</a>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">
        {error.message.startsWith("El rango") ? `${error.message}.` : "No se pudo cargar el reporte. Vuelve a intentarlo."}</p>}

      <section aria-labelledby="t-meses" className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <h2 id="t-meses" className="mb-2 text-lg font-semibold">Por mes · total {formatearSoles(total)}</h2>
        {meses.length === 0 ? <p className="text-sm text-gray-600">Sin pagos confirmados en este rango.</p> : (
          <table className="w-full max-w-md text-left text-sm">
            <thead className="text-gray-600"><tr><th className="py-1 font-medium">Mes</th><th className="py-1 font-medium">Pagos</th>
              <th className="py-1 text-right font-medium">Monto</th></tr></thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-t border-gray-100">
                  <td className="py-1">{m.mes}</td><td className="py-1">{m.pagos}</td>
                  <td className="py-1 text-right">{formatearSoles(m.centimos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {filas.length > 0 && (
        <section aria-labelledby="t-detalle" className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 id="t-detalle" className="mb-2 text-lg font-semibold">Detalle ({filas.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-600"><tr>
                {["Confirmado", "Clínica", "Plan", "Monto", "Método", "Operación", "Plan hasta"].map((t) => <th key={t} className="py-1 pr-3 font-medium">{t}</th>)}
              </tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={`${f.operacion}-${f.confirmado_el}-${f.clinica}`} className="border-t border-gray-100">
                    <td className="py-1 pr-3">{f.confirmado_el}</td><td className="py-1 pr-3">{f.clinica}</td>
                    <td className="py-1 pr-3">{f.tarifa} {NOMBRE_PERIODO[f.periodo].toLowerCase()}</td>
                    <td className="py-1 pr-3">{formatearSoles(f.monto_centimos)}{f.descuento_pct ? ` (−${f.descuento_pct} %)` : ""}</td>
                    <td className="py-1 pr-3">{NOMBRE_METODO[f.metodo as MetodoSuscripcion] ?? f.metodo}</td>
                    <td className="py-1 pr-3">{f.operacion}</td><td className="py-1">{f.plan_hasta ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
