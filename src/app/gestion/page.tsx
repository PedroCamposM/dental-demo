import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { formatearSoles } from "@/lib/dinero";
import { veGestion } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import { cargarTablero } from "@/lib/tablero/datos";
import { INDICADORES, type ClaveIndicador } from "./indicadores";

export const metadata: Metadata = { title: "Tablero de gestión – Dental Demo" };

const porcentaje = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 0 });
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

export default async function Gestion() {
  const sesion = await obtenerSesion();
  if (!sesion || !veGestion(sesion.rol)) redirect("/");

  const { tablero: t } = await cargarTablero();
  const masAntiguo = t.presupuestosAbiertos.lista[0];
  const controlMasAntiguo = t.controlesVencidos.lista[0];

  return (
    <>
      <Encabezado sesion={sesion} seccion="gestion" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Tablero de gestión</h1>
        <p className="mt-1 max-w-2xl text-gray-600">
          Pacientes que necesitan seguimiento para continuar su tratamiento. Abre cada tarjeta para ver la lista y
          contactarlos.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tarjeta clave="presupuestos" cifra={t.presupuestosAbiertos.cantidad}
            detalle={plural(t.presupuestosAbiertos.cantidad, "presupuesto espera respuesta", "presupuestos esperan respuesta")}
            monto={t.presupuestosAbiertos.cantidad > 0 ? `${formatearSoles(t.presupuestosAbiertos.centimos)} en total` : null}>
            {masAntiguo && <Nota>El más antiguo, hace {masAntiguo.dias} días</Nota>}
          </Tarjeta>
          <Tarjeta clave="detenidos" cifra={t.detenidos.cantidad}
            detalle={plural(t.detenidos.cantidad, "tratamiento detenido sin cita", "tratamientos detenidos sin cita")}
            monto={t.detenidos.cantidad > 0 ? `${formatearSoles(t.detenidos.centimos)} por realizar` : null} />
          <Tarjeta clave="controles" cifra={t.controlesVencidos.cantidad}
            detalle={plural(t.controlesVencidos.cantidad, "paciente sin su control", "pacientes sin su control")} monto={null}>
            {controlMasAntiguo && <Nota>El más antiguo, vencido hace {controlMasAntiguo.diasVencido} días</Nota>}
          </Tarjeta>
          <Tarjeta clave="cuotas" cifra={t.cuotasVencidas.cantidad}
            detalle={plural(t.cuotasVencidas.cantidad, "paciente con cuotas vencidas", "pacientes con cuotas vencidas")}
            monto={t.cuotasVencidas.cantidad > 0 ? `${formatearSoles(t.cuotasVencidas.centimos)} vencido` : null} />
          <Tarjeta clave="no-show" cifra={t.noShow.cantidad}
            detalle={`${plural(t.noShow.cantidad, "inasistencia", "inasistencias")} de ${t.noShow.citasDelMes} ${plural(t.noShow.citasDelMes, "cita", "citas")}`}
            monto={null}>
            {t.noShow.porcentaje !== null && <Nota>{porcentaje.format(t.noShow.porcentaje)} de las citas del mes</Nota>}
          </Tarjeta>
          <Tarjeta clave="mes" cifra={t.mes.aceptado.planes}
            detalle={`${plural(t.mes.aceptado.planes, "aceptado", "aceptados")} de ${t.mes.presentado.planes} ${plural(t.mes.presentado.planes, "presentado", "presentados")} este mes`}
            monto={t.mes.presentado.planes > 0
              ? `${formatearSoles(t.mes.aceptado.centimos)} de ${formatearSoles(t.mes.presentado.centimos)}`
              : null}>
            <Medidor proporcion={t.mes.conversion} />
            {t.mes.conversion === null && <Nota>Aún no hay presupuestos presentados este mes</Nota>}
          </Tarjeta>
        </div>
      </main>
    </>
  );
}

function Tarjeta({ clave, cifra, detalle, monto, children }: {
  clave: ClaveIndicador; cifra: number; detalle: string; monto: string | null; children?: React.ReactNode;
}) {
  return (
    <Link
      href={`/gestion/${clave}`}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-teal-600 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
    >
      <h2 className="text-sm font-medium text-gray-600">{INDICADORES[clave].titulo}</h2>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">{cifra}</p>
      <p className="text-sm text-gray-700">{detalle}</p>
      {monto && <p className="mt-1 text-sm tabular-nums text-gray-500">{monto}</p>}
      {children}
      <span className="mt-auto pt-4 text-sm font-medium text-teal-700 group-hover:underline">Ver pacientes →</span>
    </Link>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-gray-600">{children}</p>;
}

function Medidor({ proporcion }: { proporcion: number | null }) {
  const valor = Math.round((proporcion ?? 0) * 100);
  return (
    <div
      role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={valor} aria-label="Valor aceptado del presentado"
      className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
    >
      <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(valor, 100)}%` }} />
    </div>
  );
}
