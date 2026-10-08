"use client";

import { useActionState, useState } from "react";
import { DIAS, TIPOS_BLOQUEO } from "@/lib/agenda/horario";
import {
  anularBloqueo, cambiarEstadoSillon, crearBloqueo, crearSillon, guardarHorario,
  type EstadoBloqueo, type EstadoHorario, type EstadoSimple,
} from "./acciones";

const ENTRADA =
  "rounded-md border border-gray-300 px-2 py-1.5 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 disabled:bg-gray-50 disabled:text-gray-400 aria-[invalid=true]:border-red-500";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const SIMPLE: EstadoSimple = { error: null, mensaje: null };

function Avisos({ error, mensaje }: { error: string | null; mensaje: string | null }) {
  return (
    <>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {mensaje && <p role="status" className="text-sm text-teal-700">{mensaje}</p>}
    </>
  );
}

export type Opcion = { id: string; nombre: string };

// ---------------------------------------------------------------------------
// Sillones
// ---------------------------------------------------------------------------
export function NuevoSillon() {
  const [estado, accion, enviando] = useActionState(crearSillon, SIMPLE);
  return (
    <form action={accion} className="flex flex-wrap items-end gap-2" noValidate>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Nuevo sillón
        <input name="nombre" maxLength={40} placeholder="p. ej. Sillón 4" className={`${ENTRADA} w-48`} />
      </label>
      <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Agregando…" : "Agregar"}</button>
      <div className="w-full"><Avisos {...estado} /></div>
    </form>
  );
}

export function EstadoSillon({ id, nombre, activo }: { id: string; nombre: string; activo: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoSillon, SIMPLE);
  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activo" value={activo ? "0" : "1"} />
      <button type="submit" disabled={enviando} aria-label={`${activo ? "Desactivar" : "Activar"} ${nombre}`}
        className="text-sm font-medium text-teal-700 hover:underline disabled:opacity-60">
        {activo ? "Desactivar" : "Activar"}
      </button>
      <Avisos {...estado} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Horario semanal de un profesional
// ---------------------------------------------------------------------------
export type DiaInicial = { activo: boolean; sillon_id: string; hora_inicio: string; hora_fin: string };

export function HorarioProfesional({ profesional, nombre, sillones, inicial }: {
  profesional: string; nombre: string; sillones: Opcion[]; inicial: Record<number, DiaInicial>;
}) {
  const [estado, accion, guardando] = useActionState<EstadoHorario, FormData>(guardarHorario, {
    error: null, errores: {}, mensaje: null,
  });
  // Campos controlados: lo editado se conserva aunque el servidor devuelva un error.
  const [dias, setDias] = useState(inicial);
  const cambiar = (dia: number, cambio: Partial<DiaInicial>) =>
    setDias((d) => ({ ...d, [dia]: { ...(d[dia] ?? { activo: false, sillon_id: "", hora_inicio: "09:00", hora_fin: "19:00" }), ...cambio } }));

  return (
    <form action={accion} className="flex flex-col gap-3" noValidate aria-label={`Horario de ${nombre}`}>
      <input type="hidden" name="profesional_id" value={profesional} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">Día</th>
              <th scope="col" className="py-1 pr-3 font-medium">Desde</th>
              <th scope="col" className="py-1 pr-3 font-medium">Hasta</th>
              <th scope="col" className="py-1 font-medium">Sillón</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map((dia) => {
              const d = dias[dia] ?? { activo: false, sillon_id: "", hora_inicio: "09:00", hora_fin: "19:00" };
              const error = estado.errores[dia];
              return (
                <tr key={dia} className="align-top">
                  <td className="py-1.5 pr-3">
                    <label className="flex items-center gap-2 font-medium text-gray-700">
                      <input type="checkbox" name={`activo_${dia}`} value="1" checked={d.activo}
                        onChange={(e) => cambiar(dia, { activo: e.target.checked })} />
                      {DIAS[dia]}
                    </label>
                    {error && <p id={`error-${profesional}-${dia}`} className="mt-1 text-xs text-red-700">{error}</p>}
                  </td>
                  <td className="py-1.5 pr-3">
                    <input type="time" step={300} name={`inicio_${dia}`} value={d.hora_inicio} disabled={!d.activo}
                      aria-label={`${DIAS[dia]}: desde`} aria-invalid={!!error}
                      onChange={(e) => cambiar(dia, { hora_inicio: e.target.value })} className={ENTRADA} />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input type="time" step={300} name={`fin_${dia}`} value={d.hora_fin} disabled={!d.activo}
                      aria-label={`${DIAS[dia]}: hasta`} aria-invalid={!!error}
                      onChange={(e) => cambiar(dia, { hora_fin: e.target.value })} className={ENTRADA} />
                  </td>
                  <td className="py-1.5">
                    <select name={`sillon_${dia}`} value={d.sillon_id} disabled={!d.activo} aria-label={`${DIAS[dia]}: sillón`}
                      aria-invalid={!!error} onChange={(e) => cambiar(dia, { sillon_id: e.target.value })} className={ENTRADA}>
                      <option value="">Elegir…</option>
                      {sillones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando} className={BOTON}>
          {guardando ? "Guardando…" : `Guardar horario de ${nombre}`}
        </button>
        <Avisos error={estado.error} mensaje={estado.mensaje} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bloqueos
// ---------------------------------------------------------------------------
export function NuevoBloqueo({ profesionales, hoy }: { profesionales: Opcion[]; hoy: string }) {
  const [estado, accion, enviando] = useActionState<EstadoBloqueo, FormData>(crearBloqueo, {
    errores: {}, general: null, mensaje: null, valores: {},
  });
  const v = estado.valores;
  const e = estado.errores;
  const clave = JSON.stringify(v);   // vuelve a montar los campos con lo enviado tras un error
  const campo = (nombre: keyof typeof e, etiqueta: string, control: React.ReactNode) => (
    <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <label htmlFor={`bloqueo-${nombre}`}>{etiqueta}</label>
      {control}
      {e[nombre] && <span id={`bloqueo-${nombre}-error`} className="text-xs font-normal text-red-700">{e[nombre]}</span>}
    </div>
  );
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate key={clave}>
      <div className="grid gap-4 sm:grid-cols-2">
        {campo("tipo", "Tipo", (
          <select id="bloqueo-tipo" name="tipo" defaultValue={v.tipo ?? "vacaciones"} aria-invalid={!!e.tipo} className={ENTRADA}>
            {Object.entries(TIPOS_BLOQUEO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>
        ))}
        {campo("profesional_id", "Para", (
          <select id="bloqueo-profesional_id" name="profesional_id" defaultValue={v.profesional_id ?? ""} className={ENTRADA}>
            <option value="">Toda la clínica</option>
            {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {campo("desde", "Desde (fecha)", (
          <input id="bloqueo-desde" type="date" name="desde" min={hoy} defaultValue={v.desde ?? ""} aria-invalid={!!e.desde}
            className={ENTRADA} />
        ))}
        {campo("desde_hora", "Hora (opcional)", (
          <input id="bloqueo-desde_hora" type="time" step={300} name="desde_hora" defaultValue={v.desde_hora ?? ""}
            aria-invalid={!!e.desde_hora} className={ENTRADA} />
        ))}
        {campo("hasta", "Hasta (fecha)", (
          <input id="bloqueo-hasta" type="date" name="hasta" min={hoy} defaultValue={v.hasta ?? ""} aria-invalid={!!e.hasta}
            className={ENTRADA} />
        ))}
        {campo("hasta_hora", "Hora (opcional)", (
          <input id="bloqueo-hasta_hora" type="time" step={300} name="hasta_hora" defaultValue={v.hasta_hora ?? ""}
            aria-invalid={!!e.hasta_hora} className={ENTRADA} />
        ))}
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        Sin horas, el bloqueo cubre los días completos. Si «Hasta» queda vacío, es solo ese día.
      </p>
      {campo("motivo", "Motivo", (
        <input id="bloqueo-motivo" name="motivo" maxLength={200} defaultValue={v.motivo ?? ""} aria-invalid={!!e.motivo}
          placeholder="p. ej. Vacaciones de la Dra. Mendoza" className={ENTRADA} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Guardando…" : "Bloquear agenda"}</button>
        <Avisos error={estado.general} mensaje={estado.mensaje} />
      </div>
    </form>
  );
}

export function AnularBloqueo({ id, descripcion }: { id: string; descripcion: string }) {
  const [estado, accion, enviando] = useActionState(anularBloqueo, SIMPLE);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-teal-700 hover:underline">Anular</summary>
      <form action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Motivo de la anulación
          <input name="motivo" maxLength={200} aria-label={`Motivo para anular ${descripcion}`} className={`${ENTRADA} w-64`} />
        </label>
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        <div className="w-full"><Avisos {...estado} /></div>
      </form>
    </details>
  );
}
