"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ESPECIALIDADES, type CampoProcedimiento, type EntradaProcedimiento } from "@/lib/catalogo/validacion";
import { guardarProcedimiento, type EstadoProcedimiento } from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const DURACIONES = [10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];

function MensajeError({ campo, error }: { campo: CampoProcedimiento; error?: string }) {
  return error ? <span id={`campo-${campo}-error`} className="text-xs font-normal text-red-700">{error}</span> : null;
}

function Etiqueta({ campo, children }: { campo: CampoProcedimiento; children: React.ReactNode }) {
  return (
    <label htmlFor={`campo-${campo}`}>
      {children}<span aria-hidden="true" className="text-red-700"> *</span>
    </label>
  );
}

type Props = { id?: string; inicial: EntradaProcedimiento };

export function FormularioProcedimiento({ id, inicial }: Props) {
  const [estado, accion, guardando] = useActionState<EstadoProcedimiento, FormData>(guardarProcedimiento, {
    errores: {}, general: null, valores: inicial,
  });
  const v = estado.valores;
  const e = estado.errores;
  const duracion = Number(v.duracion_minutos);
  const duraciones = Number.isInteger(duracion) && duracion > 0 && !DURACIONES.includes(duracion)
    ? [...DURACIONES, duracion].sort((a, b) => a - b) : DURACIONES;
  // Las `key` vuelven a montar selects y casillas con lo elegido tras un envío con errores.
  const clave = JSON.stringify(v);

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {estado.general && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.general}</p>}

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <Etiqueta campo="codigo">Código</Etiqueta>
          <input id="campo-codigo" name="codigo" defaultValue={v.codigo ?? ""} key={`c${clave}`} autoComplete="off"
            aria-invalid={!!e.codigo} aria-describedby={e.codigo ? "campo-codigo-error" : "campo-codigo-ayuda"}
            className={`${ENTRADA} uppercase`} />
          {e.codigo ? <MensajeError campo="codigo" error={e.codigo} />
            : <span id="campo-codigo-ayuda" className="text-xs font-normal text-gray-500">P. ej. END-01</span>}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <Etiqueta campo="nombre">Nombre</Etiqueta>
          <input id="campo-nombre" name="nombre" defaultValue={v.nombre ?? ""} key={`n${clave}`}
            aria-invalid={!!e.nombre} aria-describedby={e.nombre ? "campo-nombre-error" : undefined} className={ENTRADA} />
          <MensajeError campo="nombre" error={e.nombre} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <Etiqueta campo="especialidad">Especialidad</Etiqueta>
          <select id="campo-especialidad" name="especialidad" defaultValue={v.especialidad ?? ""} key={`e${clave}`}
            aria-invalid={!!e.especialidad} aria-describedby={e.especialidad ? "campo-especialidad-error" : undefined}
            className={ENTRADA}>
            <option value="" disabled>Elegir…</option>
            {Object.entries(ESPECIALIDADES).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>
          <MensajeError campo="especialidad" error={e.especialidad} />
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <Etiqueta campo="precio">Precio base (S/)</Etiqueta>
          <input id="campo-precio" name="precio" inputMode="decimal" defaultValue={v.precio ?? ""} key={`p${clave}`}
            aria-invalid={!!e.precio} aria-describedby={e.precio ? "campo-precio-error" : "campo-precio-ayuda"}
            className={`${ENTRADA} tabular-nums`} />
          {e.precio ? <MensajeError campo="precio" error={e.precio} />
            : <span id="campo-precio-ayuda" className="text-xs font-normal text-gray-500">El odontólogo puede ajustarlo en cada plan.</span>}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <Etiqueta campo="duracion_minutos">Duración estándar</Etiqueta>
          <select id="campo-duracion_minutos" name="duracion_minutos" defaultValue={v.duracion_minutos ?? "30"} key={`d${clave}`}
            aria-invalid={!!e.duracion_minutos}
            aria-describedby={e.duracion_minutos ? "campo-duracion_minutos-error" : undefined} className={ENTRADA}>
            {duraciones.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          <MensajeError campo="duracion_minutos" error={e.duracion_minutos} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">Atención clínica</legend>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="requiere_consentimiento" value="1" key={`r${clave}`}
            defaultChecked={v.requiere_consentimiento === "1"} className="mt-1" />
          <span>
            Requiere consentimiento informado firmado
            <span className="block text-xs text-gray-500">
              No se podrá marcar como realizado sin él. La plantilla se elige en la ficha del procedimiento.
            </span>
          </span>
        </label>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="campo-control_dias">Control automático a los … días (opcional)</label>
          <input id="campo-control_dias" name="control_dias" type="number" inputMode="numeric" min={1} max={730}
            defaultValue={v.control_dias ?? ""} key={`k${clave}`} aria-invalid={!!e.control_dias}
            aria-describedby={e.control_dias ? "campo-control_dias-error" : "campo-control_dias-ayuda"}
            className={`${ENTRADA} w-32`} />
          {e.control_dias ? <MensajeError campo="control_dias" error={e.control_dias} />
            : <span id="campo-control_dias-ayuda" className="text-xs font-normal text-gray-500">
                Al realizarlo se agenda un control de seguimiento (p. ej. 7 para retiro de puntos). Vacío si no corresponde.
              </span>}
        </div>
      </fieldset>

      {id && (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="activo" value="1" key={`a${clave}`} defaultChecked={v.activo !== "0"} className="mt-1" />
          <span>
            Activo
            <span className="block text-xs text-gray-500">
              Un procedimiento inactivo no aparece al armar nuevos planes; los planes existentes no cambian.
            </span>
          </span>
        </label>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={guardando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {guardando ? "Guardando…" : id ? "Guardar cambios" : "Agregar al catálogo"}
        </button>
        <Link href="/configuracion/procedimientos" className="rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100">Cancelar</Link>
      </div>
    </form>
  );
}
