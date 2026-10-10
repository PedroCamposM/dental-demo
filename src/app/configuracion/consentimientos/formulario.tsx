"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CAMPOS_PLANTILLA, TIPOS_PLANTILLA } from "@/lib/clinico/consentimientos";
import { asignarPlantilla, guardarPlantilla, type EstadoAsignar, type EstadoPlantilla } from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";

const FILAS: Record<keyof typeof CAMPOS_PLANTILLA, number> = {
  nombre: 1, descripcion: 5, riesgos: 5, efectos_adversos: 4, pronostico: 3,
};

export function FormularioPlantilla({ id, inicial }: { id?: string; inicial: Record<string, string> }) {
  const [estado, accion, guardando] = useActionState<EstadoPlantilla, FormData>(guardarPlantilla, {
    errores: {}, general: null, valores: inicial,
  });
  const v = estado.valores;
  const e = estado.errores;
  const clave = JSON.stringify(v);
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {id && <input type="hidden" name="tipo" value={v.tipo} />}
      {id && <input type="hidden" name="es_ejemplo" value={v.es_ejemplo} />}
      {estado.general && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.general}</p>}
      {!id && (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 font-medium text-gray-700">Tipo</legend>
          {Object.entries(TIPOS_PLANTILLA).map(([t, texto]) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" name="tipo" value={t} defaultChecked={(v.tipo || "procedimiento") === t} key={`t${clave}`} />{texto}
            </label>
          ))}
          {e.tipo && <span className="w-full text-xs text-red-700">{e.tipo}</span>}
        </fieldset>
      )}
      {(Object.keys(CAMPOS_PLANTILLA) as (keyof typeof CAMPOS_PLANTILLA)[]).map((c) => (
        <div key={c} className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor={`p-${c}`}>{CAMPOS_PLANTILLA[c].etiqueta}{CAMPOS_PLANTILLA[c].min === 0 && " (opcional)"}</label>
          {FILAS[c] === 1 ? (
            <input id={`p-${c}`} name={c} maxLength={CAMPOS_PLANTILLA[c].max} defaultValue={v[c] ?? ""} key={`${c}${clave}`}
              aria-invalid={!!e[c]} className={ENTRADA} />
          ) : (
            <textarea id={`p-${c}`} name={c} rows={FILAS[c]} maxLength={CAMPOS_PLANTILLA[c].max} defaultValue={v[c] ?? ""}
              key={`${c}${clave}`} aria-invalid={!!e[c]} className={ENTRADA} />
          )}
          {e[c] && <span className="text-xs font-normal text-red-700">{e[c]}</span>}
        </div>
      ))}
      {id && v.es_ejemplo === "1" && (
        <label className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" name="revisada" value="1" key={`r${clave}`} defaultChecked={v.revisada === "1"} className="mt-1" />
          <span>La clínica revisó este texto de ejemplo y lo aprueba (el formato impreso deja de mostrar el aviso).</span>
        </label>
      )}
      {id && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="activa" value="1" key={`a${clave}`} defaultChecked={v.activa !== "0"} />
          Activa (una plantilla inactiva no se ofrece para nuevos consentimientos)
        </label>
      )}
      <p className="text-xs text-gray-500">
        Los consentimientos ya generados conservan el texto con el que se imprimieron: editar la plantilla solo cambia los nuevos.
      </p>
      <div className="flex gap-3">
        <button type="submit" disabled={guardando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {guardando ? "Guardando…" : id ? "Guardar cambios" : "Crear plantilla"}
        </button>
        <Link href="/configuracion/consentimientos" className="rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100">Cancelar</Link>
      </div>
    </form>
  );
}

/** En la ficha del procedimiento: qué plantilla de consentimiento usa. */
export function AsignarPlantilla({ procedimientoId, actual, plantillas }: {
  procedimientoId: string; actual: string | null; plantillas: { id: string; nombre: string }[];
}) {
  const [estado, accion, guardando] = useActionState<EstadoAsignar, FormData>(asignarPlantilla, { error: null, mensaje: null });
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="procedimiento_id" value={procedimientoId} />
      <div className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="asignar-plantilla">Plantilla de consentimiento</label>
        <select id="asignar-plantilla" name="plantilla_id" defaultValue={actual ?? ""} className={ENTRADA}>
          <option value="">Sin plantilla (se elige al generar)</option>
          {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <button type="submit" disabled={guardando} className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:opacity-60">
        {guardando ? "Guardando…" : "Guardar plantilla"}
      </button>
      {estado.error && <p role="alert" className="w-full text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="w-full text-sm text-teal-700">{estado.mensaje}</p>}
    </form>
  );
}
