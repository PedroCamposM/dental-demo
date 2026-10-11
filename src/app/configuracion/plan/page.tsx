import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { formatearSoles } from "@/lib/dinero";
import { fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { CORREO_CONTACTO, estadoPlan } from "@/lib/prueba";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import {
  ahorroAnual, NOMBRE_ESTADO_PAGO, NOMBRE_METODO, NOMBRE_PERIODO, rangoOdontologos, tarifaSugerida,
  type EstadoPago, type MetodoSuscripcion, type Periodo, type Tarifa,
} from "@/lib/suscripcion";
import { createClient } from "@/lib/supabase/server";
import { NavegacionConfiguracion } from "../navegacion";
import { FormularioReporte } from "./formulario";

export const metadata: Metadata = { title: "Plan y pagos – Dental Demo" };

type Cobro = { yape: string | null; plin: string | null; banco: string | null; cuenta: string | null; cci: string | null;
  titular: string | null; instrucciones: string | null };
type Pago = { id: string; tarifa: string; periodo: Periodo; monto_centimos: number; metodo: MetodoSuscripcion; operacion: string;
  pagado_el: string; estado: EstadoPago; motivo_rechazo: string | null; plan_hasta: string | null };

/** Plan de la clínica: estado, precios, cómo pagar, reportar el pago e historial (solo administrador). */
export default async function PlanYPagos() {
  if (!modulos.etapa17) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (sesion.rol !== "admin") redirect("/");
  const supabase = await createClient();
  const [tarifasR, cobroR, odontologosR, pagosR] = await Promise.all([
    supabase.rpc("tarifas"), supabase.rpc("datos_cobro"), supabase.rpc("odontologos_activos"),
    supabase.from("pago_suscripcion")
      .select("id, tarifa, periodo, monto_centimos, metodo, operacion, pagado_el, estado, motivo_rechazo, plan_hasta")
      .order("reportado_at", { ascending: false }).limit(24),
  ]);
  for (const [n, r] of [["tarifas", tarifasR], ["cobro", cobroR], ["odontologos", odontologosR], ["pagos", pagosR]] as const) {
    if (r.error) registrarError(`plan.${n}`, r.error);
  }
  const tarifas = (tarifasR.data ?? []) as Tarifa[];
  const cobro = ((cobroR.data ?? []) as Cobro[])[0] ?? null;
  const odontologos = typeof odontologosR.data === "number" ? odontologosR.data : 0;
  const pagos = (pagosR.data ?? []) as Pago[];
  const hoy = fechaLima(new Date());
  const sugerida = tarifaSugerida(odontologos, tarifas);
  const plan = sesion.plan;
  const est = plan ? estadoPlan(plan, hoy) : null;
  const nombreTarifa = (c: string) => tarifas.find((t) => t.codigo === c)?.nombre ?? c;
  const hayCobro = !!cobro && !!(cobro.yape || cobro.plin || cobro.cuenta || cobro.cci);
  const seccion = "mt-6 rounded-xl border border-gray-200 bg-white p-5";

  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Configuración de la clínica</h1>
        <NavegacionConfiguracion actual="plan" />

        <section aria-labelledby="t-estado" className={seccion}>
          <h2 id="t-estado" className="text-lg font-semibold">Tu plan</h2>
          {plan?.plan === "demo" ? (
            <p className="mt-2 text-gray-700">Esta es la clínica de demostración: no tiene plan ni pagos.</p>
          ) : (
            <>
              <p className={`mt-2 ${est?.soloLectura ? "font-medium text-red-700" : "text-gray-700"}`}>
                {plan?.plan === "prueba" && `Prueba gratuita hasta el ${formatearFecha(plan.prueba_hasta ?? hoy)}.`}
                {plan?.plan === "activo" && (plan.activo_hasta ? `Plan activo hasta el ${formatearFecha(plan.activo_hasta)}.` : "Plan activo.")}
                {est?.soloLectura && " Está vencido: la clínica está en solo lectura hasta que confirmemos tu pago."}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Odontólogos activos (con COP): {odontologos}.{sugerida && ` Te corresponde el plan ${sugerida.nombre}.`}
              </p>
            </>
          )}
        </section>

        <section aria-labelledby="t-precios" className={seccion}>
          <h2 id="t-precios" className="mb-3 text-lg font-semibold">Planes y precios</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-600"><tr>
                <th className="py-2 pr-4 font-medium">Plan</th><th className="py-2 pr-4 font-medium">Para</th>
                <th className="py-2 pr-4 font-medium">Mensual</th><th className="py-2 font-medium">Anual</th>
              </tr></thead>
              <tbody>
                {tarifas.map((t) => (
                  <tr key={t.codigo} className={`border-t border-gray-100 ${t.codigo === sugerida?.codigo ? "bg-teal-50" : ""}`}>
                    <td className="py-2 pr-4 font-medium">{t.nombre}</td>
                    <td className="py-2 pr-4">{rangoOdontologos(t, tarifas)}</td>
                    <td className="py-2 pr-4">{formatearSoles(t.mensual_centimos)}</td>
                    <td className="py-2">
                      {formatearSoles(t.anual_centimos)}
                      {ahorroAnual(t) > 0 && <span className="text-gray-500"> (ahorras {formatearSoles(ahorroAnual(t))})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">Todos los planes incluyen todos los módulos. El comprobante de pago se emite por separado.</p>
        </section>

        {plan?.plan !== "demo" && (
          <>
            <section aria-labelledby="t-pagar" className={seccion}>
              <h2 id="t-pagar" className="mb-3 text-lg font-semibold">Cómo pagar</h2>
              {hayCobro && cobro ? (
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  {cobro.yape && <><dt className="text-gray-600">Yape</dt><dd className="font-medium">{cobro.yape}</dd></>}
                  {cobro.plin && <><dt className="text-gray-600">Plin</dt><dd className="font-medium">{cobro.plin}</dd></>}
                  {cobro.banco && <><dt className="text-gray-600">Banco</dt><dd className="font-medium">{cobro.banco}</dd></>}
                  {cobro.cuenta && <><dt className="text-gray-600">Cuenta</dt><dd className="font-medium">{cobro.cuenta}</dd></>}
                  {cobro.cci && <><dt className="text-gray-600">CCI</dt><dd className="font-medium">{cobro.cci}</dd></>}
                  {cobro.titular && <><dt className="text-gray-600">Titular</dt><dd className="font-medium">{cobro.titular}</dd></>}
                  {cobro.instrucciones && <dd className="mt-2 whitespace-pre-line text-gray-700 sm:col-span-2">{cobro.instrucciones}</dd>}
                </dl>
              ) : (
                <p className="text-sm text-gray-700">
                  Escríbenos a <a href={`mailto:${CORREO_CONTACTO}`} className="font-medium text-teal-700 hover:underline">{CORREO_CONTACTO}</a>{" "}
                  y te enviamos los datos para pagar.
                </p>
              )}
            </section>

            <section aria-labelledby="t-reportar" className={seccion}>
              <h2 id="t-reportar" className="mb-1 text-lg font-semibold">Reportar un pago</h2>
              <p className="mb-4 text-sm text-gray-600">Después de pagar, avísanos aquí. Al confirmarlo, el plan se extiende solo.</p>
              <FormularioReporte tarifas={tarifas} sugerida={sugerida?.codigo ?? tarifas[0]?.codigo ?? ""} hoy={hoy} />
            </section>

            <section aria-labelledby="t-historial" className={seccion}>
              <h2 id="t-historial" className="mb-3 text-lg font-semibold">Pagos reportados</h2>
              {pagos.length === 0 ? <p className="text-sm text-gray-600">Aún no hay pagos reportados.</p> : (
                <ul className="flex flex-col divide-y divide-gray-100 text-sm">
                  {pagos.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <span>
                        {formatearFecha(p.pagado_el)} · {nombreTarifa(p.tarifa)} {NOMBRE_PERIODO[p.periodo].toLowerCase()} ·{" "}
                        {formatearSoles(p.monto_centimos)} · {NOMBRE_METODO[p.metodo]} {p.operacion}
                      </span>
                      <span className={p.estado === "rechazado" ? "text-red-700" : p.estado === "confirmado" ? "text-teal-800" : "text-amber-800"}>
                        {NOMBRE_ESTADO_PAGO[p.estado]}
                        {p.estado === "confirmado" && p.plan_hasta && ` (plan hasta el ${formatearFecha(p.plan_hasta)})`}
                        {p.estado === "rechazado" && p.motivo_rechazo && `: ${p.motivo_rechazo}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
