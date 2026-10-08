"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { fechaLima } from "@/lib/fechas";
import {
  esMenorDeEdad, SEXOS, TIPOS_DOCUMENTO, type CampoPaciente, type EntradaPaciente,
} from "@/lib/pacientes/validacion";
import { guardarPaciente, type EstadoFormulario } from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";

type PropsCampo = {
  campo: CampoPaciente; etiqueta: string; valor?: string; error?: string; tipo?: string; obligatorio?: boolean;
  ayuda?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

function Campo({ campo, etiqueta, valor, error, tipo = "text", obligatorio = false, ayuda, ...resto }: PropsCampo) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <span>{etiqueta}{obligatorio && <span aria-hidden="true" className="text-red-700"> *</span>}</span>
      <input
        name={campo} type={tipo} defaultValue={valor ?? ""} aria-invalid={!!error} aria-required={obligatorio}
        aria-describedby={error ? `${campo}-error` : undefined} className={ENTRADA} {...resto}
      />
      {ayuda && !error && <span className="text-xs font-normal text-gray-500">{ayuda}</span>}
      {error && <span id={`${campo}-error`} className="text-xs font-normal text-red-700">{error}</span>}
    </label>
  );
}

function Opciones({ campo, etiqueta, opciones, valor, error }: {
  campo: CampoPaciente; etiqueta: string; opciones: Record<string, string>; valor?: string; error?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
      <span>{etiqueta}<span aria-hidden="true" className="text-red-700"> *</span></span>
      <select name={campo} defaultValue={valor ?? ""} aria-invalid={!!error} className={ENTRADA}>
        <option value="" disabled>Elegir…</option>
        {Object.entries(opciones).map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
      </select>
      {error && <span className="text-xs font-normal text-red-700">{error}</span>}
    </label>
  );
}

type Props = { id?: string; inicial?: EntradaPaciente };

export function FormularioPaciente({ id, inicial = { tipo_documento: "dni" } }: Props) {
  const [estado, accion, guardando] = useActionState<EstadoFormulario, FormData>(guardarPaciente, {
    errores: {}, general: null, consentimiento: null, duplicados: [], valores: inicial,
  });
  const v = estado.valores;
  const e = estado.errores;
  const [fecha, setFecha] = useState(v.fecha_nacimiento ?? "");
  const menor = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && esMenorDeEdad(fecha, fechaLima(new Date()));

  return (
    <form action={accion} className="flex flex-col gap-6" noValidate>
      {id && <input type="hidden" name="id" value={id} />}

      {estado.duplicados.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">Posible paciente duplicado</p>
          <p className="mt-1 text-sm text-amber-900">
            Ya hay {estado.duplicados.length === 1 ? "un paciente" : "pacientes"} con el mismo nombre y fecha de nacimiento.
            Revisa antes de crear otro:
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {estado.duplicados.map((d) => (
              <li key={d.id}>
                <Link href={`/pacientes/${d.id}`} className="font-medium text-teal-800 underline">
                  {d.nombres} {d.apellidos}
                </Link>
                {d.numero_documento && ` · ${d.tipo_documento.toUpperCase()} ${d.numero_documento}`}
              </li>
            ))}
          </ul>
          <button
            type="submit" name="confirmar_duplicado" value="1"
            className="mt-3 rounded-md border border-amber-700 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            No es la misma persona: crear de todas formas
          </button>
        </div>
      )}

      {estado.general && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.general}</p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold">Identificación</legend>
        <Opciones campo="tipo_documento" valor={v.tipo_documento} error={e.tipo_documento} etiqueta="Tipo de documento" opciones={TIPOS_DOCUMENTO} />
        <Campo campo="numero_documento" valor={v.numero_documento} error={e.numero_documento} etiqueta="Número de documento" obligatorio autoComplete="off" />
        <Campo campo="nombres" valor={v.nombres} error={e.nombres} etiqueta="Nombres" obligatorio />
        <Campo campo="apellidos" valor={v.apellidos} error={e.apellidos} etiqueta="Apellidos" obligatorio />
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <span>Fecha de nacimiento<span aria-hidden="true" className="text-red-700"> *</span></span>
          <input
            name="fecha_nacimiento" type="date" defaultValue={v.fecha_nacimiento ?? ""}
            onChange={(e) => setFecha(e.target.value)} aria-invalid={!!estado.errores.fecha_nacimiento} className={ENTRADA}
          />
          {estado.errores.fecha_nacimiento && (
            <span className="text-xs font-normal text-red-700">{estado.errores.fecha_nacimiento}</span>
          )}
        </label>
        <Opciones campo="sexo" valor={v.sexo} error={e.sexo} etiqueta="Sexo" opciones={SEXOS} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold">Contacto</legend>
        <Campo
          campo="telefono" valor={v.telefono} error={e.telefono} etiqueta="Celular" tipo="tel" obligatorio={!menor} inputMode="tel"
          ayuda={menor ? "Opcional en menores: se usa el del apoderado." : "9 dígitos; se usa para WhatsApp."}
        />
        <Campo campo="ocupacion" valor={v.ocupacion} error={e.ocupacion} etiqueta="Ocupación" />
        <div className="sm:col-span-2"><Campo campo="direccion" valor={v.direccion} error={e.direccion} etiqueta="Dirección" /></div>
        <Campo campo="contacto_emergencia_nombre" valor={v.contacto_emergencia_nombre} error={e.contacto_emergencia_nombre} etiqueta="Contacto de emergencia" />
        <Campo campo="contacto_emergencia_telefono" valor={v.contacto_emergencia_telefono} error={e.contacto_emergencia_telefono} etiqueta="Celular de emergencia" tipo="tel" inputMode="tel" />
        <Campo campo="contacto_emergencia_parentesco" valor={v.contacto_emergencia_parentesco} error={e.contacto_emergencia_parentesco} etiqueta="Parentesco" />
      </fieldset>

      {menor && (
        <fieldset className="grid gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2">
          <legend className="px-1 text-lg font-semibold">Apoderado (obligatorio: es menor de edad)</legend>
          <Campo campo="apoderado_nombre" valor={v.apoderado_nombre} error={e.apoderado_nombre} etiqueta="Nombre completo" obligatorio />
          <Campo campo="apoderado_dni" valor={v.apoderado_dni} error={e.apoderado_dni} etiqueta="DNI" obligatorio inputMode="numeric" />
          <Campo campo="apoderado_telefono" valor={v.apoderado_telefono} error={e.apoderado_telefono} etiqueta="Celular" tipo="tel" obligatorio inputMode="tel" />
          <Campo campo="apoderado_parentesco" valor={v.apoderado_parentesco} error={e.apoderado_parentesco} etiqueta="Parentesco" obligatorio placeholder="madre, padre, tutor…" />
        </fieldset>
      )}

      {!id && (
        <div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="consentimiento_datos" value="1" className="mt-1" />
            <span>
              El paciente{menor ? " (por medio de su apoderado)" : ""} autoriza el tratamiento de sus datos personales
              para su atención en la clínica (Ley 29733).
            </span>
          </label>
          {estado.consentimiento && <p className="mt-1 text-xs text-red-700">{estado.consentimiento}</p>}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit" disabled={guardando}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : id ? "Guardar cambios" : "Registrar paciente"}
        </button>
        <Link href={id ? `/pacientes/${id}` : "/pacientes"} className="rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
