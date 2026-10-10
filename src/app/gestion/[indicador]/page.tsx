import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { formatearSoles } from "@/lib/dinero";
import { fechaLima, formatearFecha, hace } from "@/lib/fechas";
import { veGestion } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import type { Contacto, EstadoPlan } from "@/lib/tablero/calculos";
import { cargarTablero } from "@/lib/tablero/datos";
import {
  mensajeControl, mensajeCuotas, mensajeDetenido, mensajeNoShow, mensajePresupuesto, type Mensaje,
} from "@/lib/tablero/mensajes";
import { rellenarPlantilla } from "@/lib/whatsapp";
import { EnviarMensaje } from "../enviar-mensaje";
import { esIndicador, INDICADORES } from "../indicadores";

type Params = { params: Promise<{ indicador: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { indicador } = await params;
  return { title: esIndicador(indicador) ? `${INDICADORES[indicador].titulo} – Dental Demo` : "Dental Demo" };
}

type Fila = {
  clave: string;
  contacto: Contacto;
  titulo: string;
  detalles: string[];
  monto: string | null;
  etiqueta?: string;
  mensaje: Mensaje | null;
};

const ESTADO_PLAN: Record<EstadoPlan, string> = {
  propuesto: "Sin respuesta", aceptado: "Aceptado", en_curso: "En curso", detenido: "Detenido",
  terminado: "Terminado", rechazado: "Rechazado", reemplazado: "Reemplazado por otra versión",
};


export default async function ListaIndicador({ params }: Params) {
  const { indicador } = await params;
  if (!esIndicador(indicador)) notFound();
  const sesion = await obtenerSesion();
  if (!sesion || !veGestion(sesion.rol)) redirect("/");

  const { tablero: t, plantillas, ultimosEnvios } = await cargarTablero();
  const c = sesion.clinica;

  const filas: Fila[] = (() => {
    switch (indicador) {
      case "mes":
        return t.mes.lista.map((p) => ({
          clave: p.planIds.join(), contacto: p, titulo: p.titulo, monto: formatearSoles(p.centimos),
          detalles: [`Presentado el ${formatearFecha(p.presentado)}`], etiqueta: ESTADO_PLAN[p.estado],
          mensaje: p.estado === "propuesto" ? mensajePresupuesto(p, c) : null,
        }));
      case "presupuestos":
        return t.presupuestosAbiertos.lista.map((p) => ({
          clave: p.planIds.join(), contacto: p, titulo: p.titulo, monto: formatearSoles(p.centimos),
          detalles: [
            `Presentado el ${formatearFecha(p.presentado)} (${hace(p.dias)})`,
            ...(p.alternativas > 1 ? [`${p.alternativas} alternativas; se muestra la de mayor valor`] : []),
          ],
          etiqueta: p.vencido ? "Vencido" : undefined,
          mensaje: mensajePresupuesto(p, c),
        }));
      case "detenidos":
        return t.detenidos.lista.map((d) => ({
          clave: d.planId, contacto: d, titulo: d.titulo, monto: formatearSoles(d.centimos),
          detalles: [d.ultimaVisita ? `Última visita el ${formatearFecha(d.ultimaVisita)} (${hace(d.diasSinVisita ?? 0)})` : "Sin visitas registradas"],
          mensaje: mensajeDetenido(d, c),
        }));
      case "cuotas":
        return t.cuotasVencidas.lista.map((d) => ({
          clave: d.pacienteId, contacto: d,
          titulo: d.cuotas === 1 ? `Cuota n.º ${d.numeros[0]}` : `${d.cuotas} cuotas vencidas`,
          monto: formatearSoles(d.centimos),
          detalles: [`La más antigua venció el ${formatearFecha(d.venceMasAntigua)} (${hace(d.diasAtraso)})`],
          mensaje: mensajeCuotas(d, c),
        }));
      case "controles":
        return t.controlesVencidos.lista.map((x) => ({
          clave: x.seguimientoId, contacto: x, titulo: "Control periódico", monto: null,
          detalles: [`${x.motivo}: debía volver el ${formatearFecha(x.fecha)} (${hace(x.diasVencido)})`],
          mensaje: mensajeControl(x, c),
        }));
      case "no-show":
        return t.noShow.lista.map((n) => ({
          clave: n.citaId, contacto: n, titulo: "No asistió a su cita", monto: null,
          detalles: [`Cita del ${formatearFecha(fechaLima(n.inicio))}`],
          mensaje: mensajeNoShow(n, c),
        }));
    }
  })();

  return (
    <>
      <Encabezado sesion={sesion} seccion="gestion" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/gestion" className="text-sm font-medium text-teal-700 hover:underline">← Volver al tablero de gestión</Link>
        <h1 className="mt-3 text-2xl font-semibold">{INDICADORES[indicador].titulo}</h1>
        <p className="mt-1 text-gray-600">{INDICADORES[indicador].descripcion}</p>

        {filas.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
            No hay pacientes en esta lista. ¡Bien!
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {filas.map((f) => {
              const plantilla = f.mensaje ? plantillas[f.mensaje.destino.tipo] : undefined;
              const envio = f.mensaje ? ultimosEnvios[`${f.mensaje.destino.tipo}|${f.contacto.pacienteId}`] : undefined;
              return (
                <li key={f.clave} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {f.contacto.nombre}
                      {f.etiqueta && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {f.etiqueta}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-700">{f.titulo}</p>
                    {f.detalles.map((d) => <p key={d} className="text-sm text-gray-500">{d}</p>)}
                    {f.contacto.apoderado && (
                      <p className="text-sm text-gray-500">Apoderado: {f.contacto.apoderado}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {f.monto && <p className="text-lg font-semibold tabular-nums text-gray-900">{f.monto}</p>}
                    {f.mensaje && (
                      plantilla ? (
                        <EnviarMensaje
                          telefono={f.contacto.telefono}
                          textoInicial={rellenarPlantilla(plantilla.cuerpo, f.mensaje.variables)}
                          destino={f.mensaje.destino}
                          plantillaId={plantilla.id}
                          ultimoEnvio={envio ? formatearFecha(fechaLima(envio)) : null}
                        />
                      ) : (
                        <p className="text-sm text-gray-500">Falta la plantilla de este mensaje</p>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
