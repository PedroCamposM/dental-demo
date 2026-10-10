"use client";

import { useActionState, useState } from "react";
import { FASES_IMPLANTE, FRANKL, type TipoRegistro } from "@/lib/clinico/especialidades";
import { anularRegistroEspecialidad, registrarEspecialidad, type EstadoRegistro } from "./acciones-especialidad";

const INICIAL: EstadoRegistro = { error: null, mensaje: null, exitos: 0 };
const ENTRADA = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

type Campo = {
  nombre: string; etiqueta: string; tipo?: "texto" | "area" | "opciones" | "fecha"; ancho?: "doble";
  opciones?: [string, string][]; ayuda?: string; inicial?: string;
};

const hoyLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

/** Campos de cada formulario (la validación es la del servidor: lib/clinico/especialidades). */
export const CAMPOS: Record<TipoRegistro, { titulo: string; boton: string; campos: Campo[] }> = {
  endodoncia: {
    titulo: "Endodoncia · conducto", boton: "Registrar conducto",
    campos: [
      { nombre: "conducto", etiqueta: "Conducto", ayuda: "p. ej. MV, DV, P, único" },
      { nombre: "longitud_trabajo_mm", etiqueta: "Longitud de trabajo (mm)" },
      { nombre: "referencia", etiqueta: "Referencia" },
      { nombre: "lima_maestra", etiqueta: "Lima maestra" },
      { nombre: "irrigacion", etiqueta: "Irrigación", ancho: "doble" },
      { nombre: "tecnica_obturacion", etiqueta: "Técnica de obturación" },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "area", ancho: "doble" },
    ],
  },
  ortodoncia_caso: {
    titulo: "Ortodoncia · diagnóstico y aparatología", boton: "Registrar diagnóstico ortodóncico",
    campos: [
      { nombre: "diagnostico", etiqueta: "Diagnóstico ortodóncico", tipo: "area", ancho: "doble" },
      { nombre: "aparatologia", etiqueta: "Aparatología", tipo: "area", ancho: "doble" },
    ],
  },
  ortodoncia_control: {
    titulo: "Ortodoncia · control", boton: "Registrar control",
    campos: [
      { nombre: "arco_superior", etiqueta: "Arco superior" },
      { nombre: "arco_inferior", etiqueta: "Arco inferior" },
      { nombre: "ligaduras", etiqueta: "Ligaduras" },
      { nombre: "activaciones", etiqueta: "Activaciones" },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "area", ancho: "doble" },
    ],
  },
  implante: {
    titulo: "Implante", boton: "Registrar implante",
    campos: [
      { nombre: "marca", etiqueta: "Marca" },
      { nombre: "lote", etiqueta: "Lote" },
      { nombre: "diametro_mm", etiqueta: "Diámetro (mm)" },
      { nombre: "longitud_mm", etiqueta: "Longitud (mm)" },
      { nombre: "torque_ncm", etiqueta: "Torque de inserción (Ncm)" },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "area", ancho: "doble" },
    ],
  },
  implante_fase: {
    titulo: "Implante · fase", boton: "Registrar fase",
    campos: [
      { nombre: "fase", etiqueta: "Fase", tipo: "opciones",
        opciones: Object.entries(FASES_IMPLANTE).filter(([v]) => v !== "colocacion") },
      { nombre: "fecha", etiqueta: "Fecha", tipo: "fecha" },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "area", ancho: "doble" },
    ],
  },
  cirugia: {
    titulo: "Cirugía", boton: "Registrar cirugía",
    campos: [
      { nombre: "tecnica", etiqueta: "Técnica", tipo: "area", ancho: "doble" },
      { nombre: "sutura", etiqueta: "Sutura" },
      { nombre: "retiro_puntos_dias", etiqueta: "Retiro de puntos a los (días)", ayuda: "Al firmar se programa el control" },
      { nombre: "observaciones", etiqueta: "Observaciones", tipo: "area", ancho: "doble" },
    ],
  },
  odontopediatria: {
    titulo: "Odontopediatría", boton: "Registrar conducta",
    campos: [
      { nombre: "apoderado_presente", etiqueta: "¿Apoderado presente?", tipo: "opciones", opciones: [["si", "Sí"], ["no", "No"]] },
      { nombre: "acompanante", etiqueta: "Acompañante (nombre y parentesco)" },
      { nombre: "conducta_frankl", etiqueta: "Conducta (escala de Frankl)", tipo: "opciones",
        opciones: Object.entries(FRANKL).map(([v, t]) => [v, t]) },
      { nombre: "conducta", etiqueta: "Conducta (descripción)", tipo: "area", ancho: "doble" },
    ],
  },
};

function Campos({ prefijo, campos }: { prefijo: string; campos: Campo[] }) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.nombre, c.inicial ?? (c.tipo === "fecha" ? hoyLima() : "")])));
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {campos.map((c) => {
        const id = `${prefijo}-${c.nombre}`;
        const comun = { id, name: c.nombre, value: valores[c.nombre] ?? "", className: ENTRADA,
          onChange: (e: { target: { value: string } }) => {
            const valor = e.target.value;   // se lee aquí: el actualizador corre después
            setValores((v) => ({ ...v, [c.nombre]: valor }));
          } };
        return (
          <div key={c.nombre} className={`flex flex-col gap-1 text-xs font-medium text-gray-700 ${c.ancho === "doble" ? "sm:col-span-2" : ""}`}>
            <label htmlFor={id}>{c.etiqueta}{c.ayuda && <span className="font-normal text-gray-500"> · {c.ayuda}</span>}</label>
            {c.tipo === "area" ? <textarea rows={2} {...comun} />
              : c.tipo === "opciones" ? (
                <select {...comun}>
                  <option value="">Elige…</option>
                  {(c.opciones ?? []).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              ) : <input type={c.tipo === "fecha" ? "date" : "text"} {...comun} />}
          </div>
        );
      })}
    </div>
  );
}

/** Formulario de un registro de especialidad en la evolución en borrador. */
export function FormRegistro({ tipo, pacienteId, notaId, itemId, implanteId, pieza, prefijo, titulo }: {
  tipo: TipoRegistro; pacienteId: string; notaId: string; itemId?: string; implanteId?: string; pieza?: number | null;
  prefijo: string; titulo?: string;
}) {
  const def = CAMPOS[tipo];
  const [estado, accion, enviando] = useActionState(registrarEspecialidad, INICIAL);
  const campos = tipo === "implante" && !pieza
    ? [{ nombre: "pieza", etiqueta: "Pieza (FDI)" } as Campo, ...def.campos] : def.campos;
  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <summary className="cursor-pointer text-sm font-medium text-teal-800">{titulo ?? def.titulo}</summary>
      <form action={accion} className="mt-2 flex flex-col gap-2" noValidate aria-label={titulo ?? def.titulo}>
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="nota_id" value={notaId} />
        {itemId && <input type="hidden" name="item_plan_id" value={itemId} />}
        {implanteId && <input type="hidden" name="implante_id" value={implanteId} />}
        {tipo === "implante" && pieza ? <input type="hidden" name="pieza" value={pieza} /> : null}
        {/* La key limpia los campos tras registrar; si hay error, se conservan. */}
        <Campos key={estado.exitos} prefijo={prefijo} campos={campos} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={enviando}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
            {enviando ? "Guardando…" : def.boton}
          </button>
          {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
          {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
        </div>
      </form>
    </details>
  );
}

export function AnularRegistro({ tipo, id, pacienteId, descripcion }: {
  tipo: TipoRegistro; id: string; pacienteId: string; descripcion: string;
}) {
  const [estado, accion, enviando] = useActionState(anularRegistroEspecialidad, INICIAL);
  const [motivo, setMotivo] = useState("");
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-gray-600 hover:underline">Anular</summary>
      <form action={accion} className="mt-1 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input name="motivo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          aria-label={`Motivo para anular ${descripcion}`} placeholder="Motivo"
          className="min-w-48 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar"}
        </button>
        {estado.error && <p role="alert" className="w-full text-red-700">{estado.error}</p>}
      </form>
    </details>
  );
}
