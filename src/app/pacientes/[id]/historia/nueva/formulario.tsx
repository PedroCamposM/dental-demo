"use client";

import Link from "next/link";
import { useActionState } from "react";
import { EMBARAZO, ENFERMEDADES, HABITOS, type CampoCuestionario } from "@/lib/historia/cuestionario";
import { guardarCuestionario, type EstadoCuestionario, type ValoresCuestionario } from "../acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";

type Props = { pacienteId: string; puedeGestar: boolean; inicial: ValoresCuestionario };

export function FormularioCuestionario({ pacienteId, puedeGestar, inicial }: Props) {
  const [estado, accion, guardando] = useActionState<EstadoCuestionario, FormData>(guardarCuestionario, {
    errores: {}, general: null, valores: null,
  });
  const v = estado.valores ?? inicial;
  const e = estado.errores;
  const t = (c: string) => v.textos[c] ?? "";
  const error = (c: CampoCuestionario) =>
    e[c] ? <span id={`h-${c}-error`} className="text-xs font-normal text-red-700">{e[c]}</span> : null;
  const area = (c: CampoCuestionario, etiqueta: string, filas = 2, ayuda?: string) => (
    <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <label htmlFor={`h-${c}`}>{etiqueta}</label>
      <textarea id={`h-${c}`} name={c} rows={filas} defaultValue={t(c)} aria-invalid={!!e[c]}
        aria-describedby={e[c] ? `h-${c}-error` : undefined} className={`${ENTRADA} font-normal`} />
      {ayuda && !e[c] && <span className="text-xs font-normal text-gray-500">{ayuda}</span>}
      {error(c)}
    </div>
  );
  const casillas = (nombre: "enfermedades" | "habitos", opciones: Record<string, string>) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {Object.entries(opciones).map(([valor, texto]) => (
        <label key={valor} className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name={nombre} value={valor} defaultChecked={(v.listas[nombre] ?? []).includes(valor)} />
          {texto}
        </label>
      ))}
    </div>
  );

  return (
    // La `key` vuelve a montar el formulario con lo enviado si el servidor devuelve errores.
    <form key={JSON.stringify(v)} action={accion} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      {estado.general && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.general}</p>}

      <fieldset className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
        <legend className="px-1 text-lg font-semibold">Anamnesis</legend>
        {area("motivo_consulta", "Motivo de consulta *", 2)}
        {area("enfermedad_actual", "Enfermedad actual", 3, "Qué siente, desde cuándo y cómo ha evolucionado, en palabras del paciente.")}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
        <legend className="px-1 text-lg font-semibold">Antecedentes médicos</legend>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700">Enfermedades sistémicas</span>
          {casillas("enfermedades", ENFERMEDADES)}
        </div>
        {area("enfermedades_otras", "Otras enfermedades")}
        {area("alergias", "Alergias", 2, "Una por línea o separadas por comas. Vacío si no refiere.")}
        {area("medicacion", "Medicación actual")}
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" name="anticoagulado" value="1" defaultChecked={t("anticoagulado") === "1"} />
            Toma anticoagulantes o antiagregantes
          </label>
          <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            <label htmlFor="h-anticoagulante">¿Cuál y dosis?</label>
            <input id="h-anticoagulante" name="anticoagulante" defaultValue={t("anticoagulante")} maxLength={200}
              aria-invalid={!!e.anticoagulante} className={ENTRADA} />
            {error("anticoagulante")}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {area("cirugias", "Cirugías")}
          {area("hospitalizaciones", "Hospitalizaciones")}
        </div>
        {puedeGestar && (
          <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3">
            <span className="text-sm font-medium text-gray-700">Embarazo</span>
            <div className="flex flex-wrap gap-4">
              {(["no", "si", "no_sabe"] as const).map((op) => (
                <label key={op} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" name="embarazo" value={op} defaultChecked={(t("embarazo") || "no") === op} />
                  {EMBARAZO[op]}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                <label htmlFor="h-semanas_gestacion">Semanas de gestación (si está embarazada)</label>
                <input id="h-semanas_gestacion" name="semanas_gestacion" type="number" inputMode="numeric" min={1} max={42}
                  defaultValue={t("semanas_gestacion")} aria-invalid={!!e.semanas_gestacion} className={`${ENTRADA} w-28`} />
                {error("semanas_gestacion")}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="lactancia" value="1" defaultChecked={t("lactancia") === "1"} />
                En lactancia
              </label>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
        <legend className="px-1 text-lg font-semibold">Hábitos y antecedentes odontológicos</legend>
        {casillas("habitos", HABITOS)}
        {area("habitos_otros", "Otros hábitos")}
        {area("antecedentes_odontologicos", "Antecedentes odontológicos", 3,
          "Tratamientos previos, experiencias con la anestesia, última visita al dentista.")}
        {area("observaciones", "Observaciones", 2)}
      </fieldset>

      <div className="flex gap-3">
        <button type="submit" disabled={guardando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {guardando ? "Guardando…" : "Guardar versión nueva"}
        </button>
        <Link href={`/pacientes/${pacienteId}/historia`} className="rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
