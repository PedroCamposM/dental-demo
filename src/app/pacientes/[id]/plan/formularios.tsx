"use client";

import { useActionState, useState } from "react";
import { SUPERFICIES } from "@/lib/clinico/diagnostico";
import { formatearSoles } from "@/lib/dinero";
import type { CampoItem } from "@/lib/plan/plan";
import {
  aceptarPlan, agregarFase, agregarItem, cancelarItem, copiarPlan, crearPlan, rechazarPlan,
  type EstadoItemForm, type EstadoSimple,
} from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const BOTON_SECUNDARIO = "rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60";
const INICIAL: EstadoSimple = { error: null, intento: 0, valores: {} };

const MensajeError = ({ texto }: { texto: string | null | undefined }) =>
  texto ? <p role="alert" className="text-sm text-red-700">{texto}</p> : null;

// ---------------------------------------------------------------------------
// Nuevo plan y fases
// ---------------------------------------------------------------------------
export function NuevoPlan({ pacienteId, diagnostico }: { pacienteId: string; diagnostico?: string }) {
  const [estado, accion, guardando] = useActionState(crearPlan, INICIAL);
  return (
    <form key={estado.intento} action={accion} className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      {diagnostico && <input type="hidden" name="diagnostico" value={diagnostico} />}
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="p-titulo">Título del plan</label>
        <input id="p-titulo" name="titulo" maxLength={120} defaultValue={estado.valores.titulo ?? ""}
          placeholder="p. ej. Rehabilitación del sector posterior" className={ENTRADA} />
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="p-fase">Primera fase</label>
        <input id="p-fase" name="fase" maxLength={80} defaultValue={estado.valores.fase ?? "Fase 1"} className={ENTRADA} />
      </div>
      <button type="submit" disabled={guardando} className={BOTON}>{guardando ? "Creando…" : "Crear plan"}</button>
      <div className="sm:col-span-3"><MensajeError texto={estado.error} /></div>
    </form>
  );
}

export function NuevaFase({ pacienteId, planId }: { pacienteId: string; planId: string }) {
  const [estado, accion, guardando] = useActionState(agregarFase, INICIAL);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-teal-700 hover:underline">Agregar fase</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="plan_id" value={planId} />
        <input name="nombre" maxLength={80} aria-label="Nombre de la fase nueva" defaultValue={estado.valores.nombre ?? ""}
          placeholder="Nombre de la fase" className="min-w-56 flex-1 rounded-md border border-gray-300 px-2 py-1.5" />
        <button type="submit" disabled={guardando} className={BOTON_SECUNDARIO}>{guardando ? "Guardando…" : "Guardar fase"}</button>
        <div className="w-full"><MensajeError texto={estado.error} /></div>
      </form>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Ítem nuevo
// ---------------------------------------------------------------------------
export type OpcionesItem = {
  catalogo: { id: string; codigo: string; nombre: string; especialidad: string; precio_base_centimos: number; duracion_minutos: number }[];
  fases: { numero: number; nombre: string }[];
  diagnosticos: { id: string; texto: string; pieza: number | null }[];
  items: { id: string; texto: string }[];
};

export function NuevoItem({ pacienteId, planId, opciones, diagnosticoInicial }: {
  pacienteId: string; planId: string; opciones: OpcionesItem; diagnosticoInicial?: string;
}) {
  const inicialPieza = opciones.diagnosticos.find((d) => d.id === diagnosticoInicial)?.pieza;
  const [estado, accion, guardando] = useActionState<EstadoItemForm, FormData>(agregarItem, {
    errores: {}, mensaje: null, intento: 0, exitos: 0,
    valores: { textos: { fase: "1", diagnostico_id: diagnosticoInicial ?? "", pieza: inicialPieza ? String(inicialPieza) : "" },
      superficies: [], requiere: [] },
  });
  return <CamposItem key={estado.exitos} {...{ pacienteId, planId, opciones, estado, accion, guardando }} />;
}

/** Remontado tras cada ítem agregado (`exitos`): así también se vacía el procedimiento elegido. */
function CamposItem({ pacienteId, planId, opciones, estado, accion, guardando }: {
  pacienteId: string; planId: string; opciones: OpcionesItem; estado: EstadoItemForm;
  accion: (form: FormData) => void; guardando: boolean;
}) {
  const v = estado.valores;
  const e = estado.errores;
  const t = (c: string) => v.textos[c] ?? "";
  const [procId, setProcId] = useState(t("procedimiento_id"));
  const proc = opciones.catalogo.find((p) => p.id === procId);
  const error = (c: CampoItem) => e[c] ? <span className="text-xs font-normal text-red-700">{e[c]}</span> : null;
  // Sin Object.groupBy: las tablets con navegadores algo antiguos no lo tienen.
  const porEspecialidad = [...new Set(opciones.catalogo.map((p) => p.especialidad))]
    .map((esp) => [esp, opciones.catalogo.filter((p) => p.especialidad === esp)] as const);

  return (
    <form key={estado.intento} action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="plan_id" value={planId} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="i-procedimiento">Procedimiento (catálogo)</label>
          {/* No controlado: React 19 reinicia el formulario tras cada envío. */}
          <select id="i-procedimiento" name="procedimiento_id" defaultValue={procId} onChange={(ev) => setProcId(ev.target.value)}
            aria-invalid={!!e.procedimiento_id} className={ENTRADA}>
            <option value="">Elegir…</option>
            {porEspecialidad.map(([esp, lista]) => (
              <optgroup key={esp} label={esp}>
                {(lista ?? []).map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
              </optgroup>
            ))}
          </select>
          {error("procedimiento_id")}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="i-precio">Precio (S/)</label>
          <input id="i-precio" name="precio" inputMode="decimal" defaultValue={t("precio")} aria-invalid={!!e.precio}
            placeholder={proc ? formatearSoles(proc.precio_base_centimos).replace("S/ ", "") : "del catálogo"} className={ENTRADA} />
          <span className="text-xs font-normal text-gray-500">Vacío: precio del catálogo. Con varias piezas, es el precio de cada una.</span>
          {error("precio")}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="i-duracion">Duración (min)</label>
          <input id="i-duracion" name="duracion_minutos" inputMode="numeric" defaultValue={t("duracion_minutos")}
            aria-invalid={!!e.duracion_minutos} placeholder={proc ? String(proc.duracion_minutos) : "del catálogo"} className={ENTRADA} />
          {error("duracion_minutos")}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="i-pieza">Piezas (FDI)</label>
          <input id="i-pieza" name="pieza" inputMode="numeric" maxLength={120} defaultValue={t("pieza")} aria-invalid={!!e.pieza}
            aria-describedby="i-pieza-ayuda" className={ENTRADA} />
          <span id="i-pieza-ayuda" className="text-xs font-normal text-gray-500">
            Una o varias (p. ej. 16, 26, 36): se crea un ítem por pieza.
          </span>
          {error("pieza")}
        </div>
        <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Superficies</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {Object.entries(SUPERFICIES).map(([k, texto]) => (
              <label key={k} className="flex items-center gap-2 font-normal">
                <input type="checkbox" name="superficies" value={k} defaultChecked={v.superficies.includes(k)} /> {texto}
              </label>
            ))}
          </div>
          {error("superficies")}
        </fieldset>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="i-fase">Fase</label>
          <select id="i-fase" name="fase" defaultValue={t("fase") || "1"} aria-invalid={!!e.fase} className={ENTRADA}>
            {opciones.fases.map((f) => <option key={f.numero} value={f.numero}>{f.numero}. {f.nombre}</option>)}
          </select>
          {error("fase")}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="i-diagnostico">Diagnóstico de origen</label>
          <select id="i-diagnostico" name="diagnostico_id" defaultValue={t("diagnostico_id")} aria-invalid={!!e.diagnostico_id} className={ENTRADA}>
            <option value="">Sin diagnóstico (p. ej. preventivo)</option>
            {opciones.diagnosticos.map((d) => <option key={d.id} value={d.id}>{d.texto}</option>)}
          </select>
          <span className="text-xs font-normal text-gray-500">Con varias piezas, cada una toma su diagnóstico con el mismo CIE-10.</span>
          {error("diagnostico_id")}
        </div>
      </div>
      {opciones.items.length > 0 && (
        <fieldset className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          <legend>Se hace después de (opcional)</legend>
          <div className="flex flex-col gap-1 pt-1">
            {opciones.items.map((i) => (
              <label key={i.id} className="flex items-center gap-2 font-normal">
                <input type="checkbox" name="requiere" value={i.id} defaultChecked={v.requiere.includes(i.id)} /> {i.texto}
              </label>
            ))}
          </div>
          {error("requiere")}
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando} className={BOTON}>{guardando ? "Agregando…" : "Agregar al plan"}</button>
        <MensajeError texto={e.general} />
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

export function CancelarItem({ pacienteId, id, descripcion }: { pacienteId: string; id: string; descripcion: string }) {
  const [estado, accion, enviando] = useActionState(cancelarItem, INICIAL);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Cancelar</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <input name="motivo" maxLength={200} defaultValue={estado.valores.motivo ?? ""} aria-label={`Motivo para cancelar ${descripcion}`}
          placeholder="Motivo" className="min-w-48 flex-1 rounded-md border border-gray-300 px-2 py-1.5" />
        <button type="submit" disabled={enviando} className={BOTON_SECUNDARIO}>{enviando ? "Cancelando…" : "Confirmar cancelación"}</button>
        <div className="w-full"><MensajeError texto={estado.error} /></div>
      </form>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Decisión del paciente y copias
// ---------------------------------------------------------------------------
export function DecisionPlan({ pacienteId, planId, items }: {
  pacienteId: string; planId: string; items: { id: string; texto: string }[];
}) {
  const [aceptado, aceptar, aceptando] = useActionState(aceptarPlan, INICIAL);
  const [rechazado, rechazar, rechazando] = useActionState(rechazarPlan, INICIAL);
  const [parcial, setParcial] = useState(false);
  const elegidos = (aceptado.valores.items ?? "").split(",");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form key={aceptado.intento} action={aceptar} className="flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50/40 p-3" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="plan_id" value={planId} />
        <p className="text-sm font-medium">El paciente acepta</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="parcial" value="1" checked={parcial} onChange={(ev) => setParcial(ev.target.checked)} />
          Solo algunos ítems
        </label>
        {parcial && (
          <div className="flex flex-col gap-1 pl-6 text-sm">
            {items.map((i) => (
              <label key={i.id} className="flex items-center gap-2">
                <input type="checkbox" name="items" value={i.id} defaultChecked={elegidos.includes(i.id)} /> {i.texto}
              </label>
            ))}
          </div>
        )}
        <button type="submit" disabled={aceptando} className={BOTON}>{aceptando ? "Guardando…" : "Registrar aceptación"}</button>
        <MensajeError texto={aceptado.error} />
      </form>
      <form key={rechazado.intento} action={rechazar} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="plan_id" value={planId} />
        <label htmlFor={`rechazo-${planId}`} className="text-sm font-medium">El paciente no acepta</label>
        <input id={`rechazo-${planId}`} name="motivo" maxLength={200} defaultValue={rechazado.valores.motivo ?? ""}
          placeholder="Motivo que dio el paciente" className={ENTRADA} />
        <button type="submit" disabled={rechazando} className={BOTON_SECUNDARIO}>{rechazando ? "Guardando…" : "Registrar rechazo"}</button>
        <MensajeError texto={rechazado.error} />
      </form>
    </div>
  );
}

export function CopiarPlan({ pacienteId, planId, alternativa }: { pacienteId: string; planId: string; alternativa: boolean }) {
  const [estado, accion, copiando] = useActionState(copiarPlan, INICIAL);
  return (
    <form key={estado.intento} action={accion} className="flex flex-wrap items-center gap-2" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="plan_id" value={planId} />
      <button type="submit" name="como" value="version" disabled={copiando} className={BOTON_SECUNDARIO}>Nueva versión</button>
      {alternativa && (
        <button type="submit" name="como" value="alternativa" disabled={copiando} className={BOTON_SECUNDARIO}>Nueva alternativa</button>
      )}
      <MensajeError texto={estado.error} />
    </form>
  );
}
