import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { formatearSoles } from "@/lib/dinero";
import { obtenerSesion } from "@/lib/sesion";
import { cargarTablero } from "@/lib/tablero/datos";
import { cerrarSesion } from "./login/actions";
import { INDICADORES, type ClaveIndicador } from "./riesgo/indicadores";

const porcentaje = new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 0 });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export default async function Inicio() {
  const sesion = await obtenerSesion();
  if (!sesion) return <SinClinica />;

  const { tablero: t } = await cargarTablero();
  const masAntiguo = t.presupuestosAbiertos.lista[0];
  const controlMasAntiguo = t.controlesVencidos.lista[0];

  return (
    <>
      <Encabezado sesion={sesion} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section aria-labelledby="titulo-riesgo">
          <h1 id="titulo-riesgo" className="text-sm font-medium uppercase tracking-wide text-gray-500">
            Dinero en riesgo hoy
          </h1>
          <p className="mt-1 text-4xl font-semibold tabular-nums sm:text-5xl">{formatearSoles(t.enRiesgo)}</p>
          <p className="mt-2 max-w-2xl text-gray-600">
            Presupuestos sin respuesta, tratamientos detenidos y cuotas vencidas. Abre cada número para ver a
            quién llamar hoy.
          </p>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tarjeta clave="mes" valor={formatearSoles(t.mes.aceptado.centimos)}
            detalle={`aceptado de ${formatearSoles(t.mes.presentado.centimos)} presentado`}>
            <Medidor proporcion={t.mes.conversion} />
            <p className="mt-2 text-sm text-gray-600">
              {t.mes.conversion === null
                ? "Aún no hay presupuestos presentados este mes"
                : `${porcentaje.format(t.mes.conversion)} del valor · ${t.mes.aceptado.planes} de ${plural(t.mes.presentado.planes, "presupuesto", "presupuestos")}`}
            </p>
          </Tarjeta>
          <Tarjeta clave="presupuestos" valor={formatearSoles(t.presupuestosAbiertos.centimos)}
            detalle={plural(t.presupuestosAbiertos.cantidad, "presupuesto abierto", "presupuestos abiertos")}>
            {masAntiguo && <p className="mt-2 text-sm text-gray-600">El más antiguo, hace {masAntiguo.dias} días</p>}
          </Tarjeta>
          <Tarjeta clave="detenidos" valor={formatearSoles(t.detenidos.centimos)}
            detalle={`por hacer en ${plural(t.detenidos.cantidad, "tratamiento", "tratamientos")}`} />
          <Tarjeta clave="cuotas" valor={formatearSoles(t.cuotasVencidas.centimos)}
            detalle={`vencido en ${plural(t.cuotasVencidas.cantidad, "paciente", "pacientes")}`} />
          <Tarjeta clave="controles" valor={String(t.controlesVencidos.cantidad)}
            detalle={t.controlesVencidos.cantidad === 1 ? "paciente sin su control" : "pacientes sin su control"}>
            {controlMasAntiguo && (
              <p className="mt-2 text-sm text-gray-600">El más antiguo, vencido hace {controlMasAntiguo.diasVencido} días</p>
            )}
          </Tarjeta>
          <Tarjeta clave="no-show" valor={String(t.noShow.cantidad)}
            detalle={`${t.noShow.cantidad === 1 ? "inasistencia" : "inasistencias"} de ${plural(t.noShow.citasDelMes, "cita", "citas")}`}>
            {t.noShow.porcentaje !== null && (
              <p className="mt-2 text-sm text-gray-600">{porcentaje.format(t.noShow.porcentaje)} de las citas del mes</p>
            )}
          </Tarjeta>
        </div>
      </main>
    </>
  );
}

function Tarjeta({ clave, valor, detalle, children }: {
  clave: ClaveIndicador; valor: string; detalle: string; children?: React.ReactNode;
}) {
  return (
    <Link
      href={`/riesgo/${clave}`}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-teal-600 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
    >
      <h2 className="text-sm font-medium text-gray-600">{INDICADORES[clave].titulo}</h2>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">{valor}</p>
      <p className="text-sm text-gray-600">{detalle}</p>
      {children}
      <span className="mt-auto pt-4 text-sm font-medium text-teal-700 group-hover:underline">Ver pacientes →</span>
    </Link>
  );
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

function SinClinica() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Sin acceso a una clínica</h1>
      <p className="text-gray-600">
        Tu usuario no está activo en ninguna clínica. Pide al administrador que te invite o te reactive.
      </p>
      <form action={cerrarSesion}>
        <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
