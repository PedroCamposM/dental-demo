"use client";

import { useActionState, useState } from "react";
import { cancelarOrden, crearOrden, enviarOrden, recibirOrden, type EstadoOrden } from "./acciones";

const INICIAL: EstadoOrden = { error: null, mensaje: null, exitos: 0 };
const ENTRADA = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";
const hoyLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

function Mensajes({ estado }: { estado: EstadoOrden }) {
  return (
    <>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
    </>
  );
}

/** Campos controlados: se conservan si hay error; la `key` del padre los limpia tras guardar. */
function useCampos<T extends Record<string, string>>(inicial: T) {
  const [v, setV] = useState(inicial);
  const props = (nombre: keyof T & string) => ({
    name: nombre, value: v[nombre],
    onChange: (e: { target: { value: string } }) => { const valor = e.target.value; setV((x) => ({ ...x, [nombre]: valor })); },
  });
  return props;
}

export function NuevaOrden({ pacienteId, items, laboratorios }: {
  pacienteId: string; items: { id: string; descripcion: string }[]; laboratorios: { id: string; nombre: string }[];
}) {
  const [estado, accion, enviando] = useActionState(crearOrden, INICIAL);
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <CamposOrden key={estado.exitos} items={items} laboratorios={laboratorios} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Guardando…" : "Registrar orden"}
        </button>
        <Mensajes estado={estado} />
      </div>
    </form>
  );
}

function CamposOrden({ items, laboratorios }: { items: { id: string; descripcion: string }[]; laboratorios: { id: string; nombre: string }[] }) {
  const campo = useCampos({ item_plan_id: "", laboratorio_id: "", tipo_trabajo: "", color: "", costo: "", indicaciones: "" });
  const etiqueta = "flex flex-col gap-1 text-sm font-medium text-gray-700";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={etiqueta}>Ítem del plan
        <select {...campo("item_plan_id")} className={ENTRADA}>
          <option value="">Elige…</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.descripcion}</option>)}
        </select>
      </label>
      <label className={etiqueta}>Laboratorio
        <select {...campo("laboratorio_id")} className={ENTRADA}>
          <option value="">Elige…</option>
          {laboratorios.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </label>
      <label className={etiqueta}>Tipo de trabajo<input {...campo("tipo_trabajo")} className={ENTRADA} placeholder="p. ej. Corona de zirconio" /></label>
      <label className={etiqueta}>Color<input {...campo("color")} className={ENTRADA} placeholder="p. ej. A2" /></label>
      <label className={etiqueta}>Costo del laboratorio (S/, opcional)<input {...campo("costo")} inputMode="decimal" className={ENTRADA} /></label>
      <label className={`${etiqueta} sm:col-span-2`}>Indicaciones<textarea rows={2} {...campo("indicaciones")} className={ENTRADA} /></label>
    </div>
  );
}

/** Acciones de una orden según su estado: enviar, cambiar la entrega, recibir, cancelar. */
export function AccionesOrden({ id, pacienteId, estado, envio, entrega, descripcion }: {
  id: string; pacienteId: string; estado: string; envio: string | null; entrega: string | null; descripcion: string;
}) {
  if (estado !== "por_enviar" && estado !== "en_laboratorio") return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      <FormEnvio id={id} pacienteId={pacienteId} envio={envio} entrega={entrega} descripcion={descripcion}
        titulo={estado === "por_enviar" ? "Registrar envío" : "Cambiar entrega prevista"} />
      {estado === "en_laboratorio" && <FormRecepcion id={id} pacienteId={pacienteId} envio={envio} descripcion={descripcion} />}
      <FormCancelar id={id} pacienteId={pacienteId} descripcion={descripcion} />
    </div>
  );
}

function FormEnvio({ id, pacienteId, envio, entrega, descripcion, titulo }: {
  id: string; pacienteId: string; envio: string | null; entrega: string | null; descripcion: string; titulo: string;
}) {
  const [estado, accion, enviando] = useActionState(enviarOrden, INICIAL);
  const campo = useCampos({ fecha_envio: envio ?? hoyLima(), fecha_entrega_prevista: entrega ?? "" });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-teal-800 hover:underline">{titulo}</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate aria-label={`${titulo}: ${descripcion}`}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="paciente_id" value={pacienteId} />
        {envio ? <input type="hidden" name="fecha_envio" value={envio} /> : (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">Fecha de envío
            <input type="date" {...campo("fecha_envio")} className={ENTRADA} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">Entrega prevista
          <input type="date" {...campo("fecha_entrega_prevista")} className={ENTRADA} />
        </label>
        <button type="submit" disabled={enviando} className="rounded-md bg-teal-700 px-3 py-1.5 text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Guardando…" : "Guardar"}
        </button>
        <div className="w-full"><Mensajes estado={estado} /></div>
      </form>
    </details>
  );
}

function FormRecepcion({ id, pacienteId, envio, descripcion }: { id: string; pacienteId: string; envio: string | null; descripcion: string }) {
  const [estado, accion, enviando] = useActionState(recibirOrden, INICIAL);
  const campo = useCampos({ fecha_recepcion: hoyLima(), costo: "" });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-teal-800 hover:underline">Registrar recepción</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate aria-label={`Registrar recepción: ${descripcion}`}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="envio" value={envio ?? ""} />
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">Fecha de recepción
          <input type="date" {...campo("fecha_recepcion")} className={ENTRADA} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">Costo final (S/, opcional)
          <input inputMode="decimal" {...campo("costo")} className={ENTRADA} />
        </label>
        <button type="submit" disabled={enviando} className="rounded-md bg-teal-700 px-3 py-1.5 text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Guardando…" : "Recibir"}
        </button>
        <div className="w-full"><Mensajes estado={estado} /></div>
      </form>
    </details>
  );
}

function FormCancelar({ id, pacienteId, descripcion }: { id: string; pacienteId: string; descripcion: string }) {
  const [estado, accion, enviando] = useActionState(cancelarOrden, INICIAL);
  const campo = useCampos({ motivo: "" });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Cancelar</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input {...campo("motivo")} maxLength={300} aria-label={`Motivo para cancelar ${descripcion}`} placeholder="Motivo"
          className="min-w-48 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Cancelando…" : "Confirmar cancelación"}
        </button>
        <div className="w-full"><Mensajes estado={estado} /></div>
      </form>
    </details>
  );
}
