import "server-only";
import Link from "next/link";
import { diasAtraso, ESTADOS_ORDEN, type EstadoOrden } from "@/lib/clinico/laboratorio";
import { formatearSoles } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { AccionesOrden } from "./componentes";

export type Orden = {
  id: string; paciente_id: string; pieza: number | null; tipo_trabajo: string; color: string | null; indicaciones: string | null;
  estado: EstadoOrden; fecha_envio: string | null; fecha_entrega_prevista: string | null; fecha_recepcion: string | null;
  costo_centimos: number | null; motivo_cancelacion: string | null; created_at: string;
  laboratorio: { nombre: string } | null;
  item_plan: { procedimiento: string } | null;
  paciente: { nombres: string; apellidos: string } | null;
};
export const COLUMNAS_ORDEN = "id, paciente_id, pieza, tipo_trabajo, color, indicaciones, estado, fecha_envio, fecha_entrega_prevista, "
  + "fecha_recepcion, costo_centimos, motivo_cancelacion, created_at, laboratorio(nombre), item_plan(procedimiento), paciente(nombres, apellidos)";

const COLOR: Record<EstadoOrden, string> = {
  por_enviar: "bg-gray-100 text-gray-700", en_laboratorio: "bg-sky-50 text-sky-800",
  recibida: "bg-teal-50 text-teal-800", cancelada: "bg-gray-50 text-gray-500 line-through",
};

/** Lista de órdenes con su estado, atraso y acciones. */
export function ListaOrdenes({ ordenes, hoy, conPaciente }: { ordenes: Orden[]; hoy: string; conPaciente: boolean }) {
  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm">
      {ordenes.map((o) => {
        const atraso = diasAtraso(o, hoy);
        const descripcion = `${o.tipo_trabajo}${o.pieza ? ` (pieza ${o.pieza})` : ""}`;
        return (
          <li key={o.id} data-orden={o.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p>
                {conPaciente && o.paciente && (
                  <><Link href={`/pacientes/${o.paciente_id}/laboratorio`} className="font-medium text-teal-800 hover:underline">
                    {o.paciente.apellidos}, {o.paciente.nombres}</Link>{" · "}</>
                )}
                <span className="font-medium">{descripcion}</span>
                {o.color && <> · color {o.color}</>} · {o.laboratorio?.nombre ?? "Laboratorio"}
              </p>
              <span className="flex items-center gap-2">
                {atraso > 0 && <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">Atrasada {atraso} {atraso === 1 ? "día" : "días"}</span>}
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${COLOR[o.estado]}`}>{ESTADOS_ORDEN[o.estado]}</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-600">
              Ítem: {o.item_plan?.procedimiento ?? "—"}
              {o.fecha_envio && <> · enviada el {formatearFecha(o.fecha_envio)}</>}
              {o.fecha_entrega_prevista && <> · entrega prevista {formatearFecha(o.fecha_entrega_prevista)}</>}
              {o.fecha_recepcion && <> · recibida el {formatearFecha(o.fecha_recepcion)}</>}
              {o.costo_centimos !== null && <> · costo {formatearSoles(o.costo_centimos)}</>}
            </p>
            {o.indicaciones && <p className="mt-0.5 text-xs text-gray-600">Indicaciones: {o.indicaciones}</p>}
            {o.motivo_cancelacion && <p className="mt-0.5 text-xs text-gray-600">Cancelada: {o.motivo_cancelacion}</p>}
            <AccionesOrden id={o.id} pacienteId={o.paciente_id} estado={o.estado} envio={o.fecha_envio}
              entrega={o.fecha_entrega_prevista} descripcion={descripcion} />
          </li>
        );
      })}
    </ul>
  );
}
