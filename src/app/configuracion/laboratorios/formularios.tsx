"use client";

import { useActionState, useState } from "react";
import { cambiarActivo, crearLaboratorio, type EstadoLaboratorio } from "./acciones";

const INICIAL: EstadoLaboratorio = { error: null, mensaje: null, exitos: 0 };
const ENTRADA = "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

export function NuevoLaboratorio() {
  const [estado, accion, enviando] = useActionState(crearLaboratorio, INICIAL);
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      {/* La key limpia los campos tras agregar; si hay error, se conservan. */}
      <Campos key={estado.exitos} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {enviando ? "Guardando…" : "Agregar laboratorio"}
        </button>
        {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

function Campos() {
  const [v, setV] = useState({ nombre: "", telefono: "", contacto: "" });
  const campo = (nombre: keyof typeof v, etiqueta: string) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      {etiqueta}
      <input name={nombre} value={v[nombre]} className={ENTRADA}
        onChange={(e) => { const valor = e.target.value; setV((x) => ({ ...x, [nombre]: valor })); }} />
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {campo("nombre", "Nombre")}
      {campo("telefono", "Teléfono (opcional)")}
      {campo("contacto", "Contacto (opcional)")}
    </div>
  );
}

export function ActivarLaboratorio({ id, nombre, activo }: { id: string; nombre: string; activo: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarActivo, INICIAL);
  return (
    <form action={accion} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={activo ? "0" : "1"} />
      <button type="submit" disabled={enviando} aria-label={`${activo ? "Desactivar" : "Activar"} ${nombre}`}
        className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50">
        {activo ? "Desactivar" : "Activar"}
      </button>
      {estado.error && <span role="alert" className="text-xs text-red-700">{estado.error}</span>}
    </form>
  );
}
