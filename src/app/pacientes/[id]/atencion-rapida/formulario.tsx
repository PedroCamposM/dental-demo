"use client";

import { useActionState } from "react";
import { EMBARAZO, ENFERMEDADES } from "@/lib/historia/cuestionario";
import { DENTICIONES } from "@/lib/odontograma/hallazgo";
import {
  abrirLaborHoy, crearOdontogramaFicha, crearPlanFicha, guardarAnamnesis, type EstadoAnamnesis, type EstadoCrear,
} from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const BOTON = "min-h-10 rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const ETIQUETA = "flex flex-col gap-1 text-sm font-medium text-gray-700";

// ---------------------------------------------------------------------------
// Anamnesis: motivo, enfermedad actual, alergias y antecedentes (como en la hoja de papel)
// ---------------------------------------------------------------------------
export type InicialAnamnesis = {
  motivo_consulta: string; enfermedad_actual: string; alergias: string; alergias_ninguna: boolean; enfermedades: string[];
  enfermedades_otras: string; antecedentes_familiares: string; medicacion: string; anticoagulado: boolean; anticoagulante: string;
  embarazo: string; semanas_gestacion: string;
};

export function FormAnamnesis({ pacienteId, inicial, preguntarEmbarazo }: {
  pacienteId: string; inicial: InicialAnamnesis; preguntarEmbarazo: boolean;
}) {
  const [estado, accion, guardando] = useActionState<EstadoAnamnesis, FormData>(guardarAnamnesis, {
    errores: {}, mensaje: null, intento: 0, valores: null,
  });
  const t = estado.valores?.textos;
  const v = (c: keyof InicialAnamnesis): string => (t ? t[c] ?? "" : String(inicial[c] ?? ""));
  const marcado = (c: "alergias_ninguna" | "anticoagulado") => (t ? t[c] === "1" : inicial[c]);
  const enfermedades = estado.valores?.enfermedades ?? inicial.enfermedades;
  const e = estado.errores;
  const error = (c: string) => e[c] ? <span id={`fa-${c}-error`} className="text-xs font-normal text-red-700">{e[c]}</span> : null;
  return (
    <form key={estado.intento} action={accion} className="flex flex-col gap-4" noValidate aria-label="Anamnesis">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className={ETIQUETA}>
          Motivo de consulta *
          <textarea name="motivo_consulta" rows={2} maxLength={500} defaultValue={v("motivo_consulta")} aria-required
            aria-invalid={!!e.motivo_consulta} className={ENTRADA} />
          {error("motivo_consulta")}
        </label>
        <label className={ETIQUETA}>
          Enfermedad actual
          <textarea name="enfermedad_actual" rows={2} maxLength={2000} defaultValue={v("enfermedad_actual")}
            aria-invalid={!!e.enfermedad_actual} className={ENTRADA} />
          {error("enfermedad_actual")}
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">Alergias *</legend>
        <div className="flex flex-wrap items-center gap-3">
          <input name="alergias" aria-label="Alergias" maxLength={600} defaultValue={v("alergias")} placeholder="p. ej. penicilina, látex"
            aria-invalid={!!e.alergias} className={`${ENTRADA} max-w-md`} />
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="alergias_ninguna" value="1" defaultChecked={marcado("alergias_ninguna")} /> Ninguna conocida
          </label>
        </div>
        {error("alergias")}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">Antecedentes</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ENFERMEDADES).map(([k, texto]) => (
            <label key={k} className="flex min-h-10 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm">
              <input type="checkbox" name="enfermedades" value={k} defaultChecked={enfermedades.includes(k)} /> {texto}
            </label>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={ETIQUETA}>
            Otros antecedentes personales
            <input name="enfermedades_otras" maxLength={500} defaultValue={v("enfermedades_otras")} className={ENTRADA} />
            {error("enfermedades_otras")}
          </label>
          <label className={ETIQUETA}>
            Medicación actual
            <input name="medicacion" maxLength={1000} defaultValue={v("medicacion")} className={ENTRADA} />
            {error("medicacion")}
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="anticoagulado" value="1" defaultChecked={marcado("anticoagulado")} /> Toma anticoagulantes
          </label>
          <label className={`${ETIQUETA} min-w-56 flex-1`}>
            ¿Cuál?
            <input name="anticoagulante" maxLength={200} defaultValue={v("anticoagulante")} aria-invalid={!!e.anticoagulante} className={ENTRADA} />
            {error("anticoagulante")}
          </label>
        </div>
        {preguntarEmbarazo && (
          <div className="flex flex-wrap items-end gap-3">
            <label className={ETIQUETA}>
              Embarazo
              <select name="embarazo" defaultValue={v("embarazo") || "no"} className={ENTRADA}>
                {Object.entries(EMBARAZO).filter(([k]) => k !== "no_aplica").map(([k, texto]) => <option key={k} value={k}>{texto}</option>)}
              </select>
            </label>
            <label className={ETIQUETA}>
              Semanas de gestación
              <input name="semanas_gestacion" inputMode="numeric" maxLength={2} defaultValue={v("semanas_gestacion")}
                aria-invalid={!!e.semanas_gestacion} className={`${ENTRADA} w-28`} />
              {error("semanas_gestacion")}
            </label>
          </div>
        )}
        <details className="text-sm">
          <summary className="inline-flex min-h-10 cursor-pointer items-center text-teal-700">Antecedentes familiares</summary>
          <textarea name="antecedentes_familiares" aria-label="Antecedentes familiares" rows={2} maxLength={1000}
            defaultValue={v("antecedentes_familiares")} className={`${ENTRADA} mt-1`} />
        </details>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={guardando} className={BOTON}>{guardando ? "Guardando…" : "Guardar anamnesis"}</button>
        {(e.general || Object.keys(e).length > 0) && (
          <p role="alert" className="text-sm text-red-700">{e.general ?? "Revisa los campos marcados."}</p>
        )}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Crear lo que falta: odontograma, plan, labor de hoy
// ---------------------------------------------------------------------------
const INICIAL: EstadoCrear = { error: null, intento: 0, valores: {} };

export function CrearOdontograma({ pacienteId, denticionSugerida }: { pacienteId: string; denticionSugerida: string }) {
  const [estado, accion, enviando] = useActionState(crearOdontogramaFicha, INICIAL);
  return (
    <form key={estado.intento} action={accion} aria-label="Crear odontograma" className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700">Dentición</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DENTICIONES).map(([k, texto]) => (
            <label key={k} className="flex min-h-10 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm">
              <input type="radio" name="denticion" value={k} defaultChecked={(estado.valores.denticion || denticionSugerida) === k} /> {texto}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={ETIQUETA}>
        Especificaciones (opcional)
        <textarea name="especificaciones" rows={2} maxLength={1000} defaultValue={estado.valores.especificaciones ?? ""}
          placeholder="p. ej. fluorosis, color del metal" className={ENTRADA} />
        <span className="text-xs font-normal text-gray-500">Las especificaciones quedan con el odontograma (no se editan después).</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Creando…" : "Empezar odontograma"}</button>
        {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      </div>
    </form>
  );
}

export function CrearPlan({ pacienteId }: { pacienteId: string }) {
  const [estado, accion, enviando] = useActionState(crearPlanFicha, INICIAL);
  return (
    <form action={accion} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Creando…" : "Empezar plan de tratamiento"}</button>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
    </form>
  );
}

export function AbrirLabor({ pacienteId }: { pacienteId: string }) {
  const [estado, accion, enviando] = useActionState(abrirLaborHoy, INICIAL);
  return (
    <form action={accion} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Abriendo…" : "Registrar labor de hoy"}</button>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
    </form>
  );
}
