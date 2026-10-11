"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CAMPOS_MEDICAMENTO, MAX_MEDICAMENTOS, TIPOS_CONSTANCIA, type CampoMedicamento } from "@/lib/clinico/documentos";
import {
  anularDocumento, desactivarPlantillaReceta, emitirConstancia, emitirReceta,
  type EstadoConstancia, type EstadoReceta, type EstadoSimple,
} from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const CAMPOS = Object.keys(CAMPOS_MEDICAMENTO) as CampoMedicamento[];
const PISTAS: Record<CampoMedicamento, string> = {
  medicamento: "Nombre (DCI)", presentacion: "p. ej. tabletas de …", dosis: "", frecuencia: "", duracion: "", indicaciones: "",
};

type Fila = Record<CampoMedicamento, string>;
const vacia = (): Fila => ({ medicamento: "", presentacion: "", dosis: "", frecuencia: "", duracion: "", indicaciones: "" });

export type PlantillaReceta = { id: string; nombre: string; items: Partial<Fila>[]; indicaciones: string | null };
export type OpcionSesion = { id: string; texto: string };

/** Receta: el profesional escribe cada medicamento; las plantillas son las suyas. */
export function FormularioReceta({ pacienteId, plantillas, sesiones }: {
  pacienteId: string; plantillas: PlantillaReceta[]; sesiones: OpcionSesion[];
}) {
  const [estado, accion, enviando] = useActionState<EstadoReceta, FormData>(emitirReceta, {
    filas: {}, general: null, mensaje: null, exitos: 0, emitida: null,
  });
  return (
    <div className="flex flex-col gap-3">
      {/* La `key` limpia los medicamentos después de cada receta emitida. */}
      <CuerpoReceta key={estado.exitos} pacienteId={pacienteId} plantillas={plantillas} sesiones={sesiones}
        accion={accion} enviando={enviando} estado={estado} />
      {estado.mensaje && (
        <p role="status" className="text-sm text-teal-700">
          {estado.mensaje}{" "}
          {estado.emitida && (
            <Link href={`/pacientes/${pacienteId}/documentos/receta/${estado.emitida}`} target="_blank"
              className="font-medium underline">Imprimir receta</Link>
          )}
        </p>
      )}
    </div>
  );
}

function CuerpoReceta({ pacienteId, plantillas, sesiones, accion, enviando, estado }: {
  pacienteId: string; plantillas: PlantillaReceta[]; sesiones: OpcionSesion[];
  accion: (f: FormData) => void; enviando: boolean; estado: EstadoReceta;
}) {
  const [filas, setFilas] = useState<Fila[]>([vacia()]);
  const [indicaciones, setIndicaciones] = useState("");
  // Controlados: React limpia los campos no controlados después de cada envío, también si hay errores.
  const [nota, setNota] = useState("");
  const [guardarComo, setGuardarComo] = useState("");
  const cambiar = (i: number, c: CampoMedicamento, v: string) =>
    setFilas((f) => f.map((fila, j) => (j === i ? { ...fila, [c]: v } : fila)));
  const usarPlantilla = (id: string) => {
    const p = plantillas.find((x) => x.id === id);
    if (!p) return;
    setFilas(p.items.map((it) => ({ ...vacia(), ...Object.fromEntries(CAMPOS.map((c) => [c, String(it[c] ?? "")])) })));
    setIndicaciones(p.indicaciones ?? "");
  };
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {plantillas.length > 0 && (
          <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            <label htmlFor="r-plantilla">Usar una de mis plantillas</label>
            <select id="r-plantilla" defaultValue="" onChange={(e) => usarPlantilla(e.target.value)} className={ENTRADA}>
              <option value="">Elegir…</option>
              {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="r-sesion">Sesión (opcional)</label>
          <select id="r-sesion" name="nota_id" value={nota} onChange={(e) => setNota(e.target.value)} className={ENTRADA}>
            <option value="">Sin sesión</option>
            {sesiones.map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}
          </select>
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {filas.map((f, i) => (
          <li key={i} className="rounded-lg border border-gray-200 p-3">
            <p className="mb-2 text-sm font-semibold">Medicamento {i + 1}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {CAMPOS.map((c) => (
                <label key={c} className={`flex flex-col gap-1 text-xs font-medium text-gray-700 ${c === "medicamento" || c === "indicaciones" ? "sm:col-span-3" : ""}`}>
                  {CAMPOS_MEDICAMENTO[c].etiqueta}{c === "indicaciones" && " (opcional)"}
                  <input name={c} value={f[c]} maxLength={CAMPOS_MEDICAMENTO[c].max} placeholder={PISTAS[c]}
                    onChange={(e) => cambiar(i, c, e.target.value)} aria-label={`${CAMPOS_MEDICAMENTO[c].etiqueta} ${i + 1}`}
                    aria-invalid={!!estado.filas[i]} className={ENTRADA} />
                </label>
              ))}
            </div>
            {estado.filas[i] && <p className="mt-1 text-xs text-red-700">{estado.filas[i]}</p>}
            {filas.length > 1 && (
              <button type="button" onClick={() => setFilas((x) => x.filter((_, j) => j !== i))}
                className="mt-2 text-xs text-gray-600 hover:underline">Quitar</button>
            )}
          </li>
        ))}
      </ol>
      {filas.length < MAX_MEDICAMENTOS && (
        <button type="button" onClick={() => setFilas((x) => [...x, vacia()])}
          className="self-start text-sm font-medium text-teal-700 hover:underline">+ Otro medicamento</button>
      )}
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="r-indicaciones">Indicaciones generales (opcional)</label>
        <textarea id="r-indicaciones" name="indicaciones_generales" rows={2} maxLength={2000} value={indicaciones}
          onChange={(e) => setIndicaciones(e.target.value)} className={ENTRADA} />
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="r-guardar">Guardar también como plantilla (opcional)</label>
        <input id="r-guardar" name="guardar_como" maxLength={80} placeholder="Nombre de la plantilla" value={guardarComo}
          onChange={(e) => setGuardarComo(e.target.value)} className={ENTRADA} />
      </div>
      <p className="text-xs text-gray-500">El sistema no sugiere medicamentos ni dosis: escribe lo que indicas.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Emitiendo…" : "Emitir receta"}</button>
        {estado.general && <p role="alert" className="text-sm text-red-700">{estado.general}</p>}
      </div>
    </form>
  );
}

/** Constancia de atención o certificado de descanso. */
export function FormularioConstancia({ pacienteId, hoy, tratamientos }: {
  pacienteId: string; hoy: string;
  /** Tratamiento sugerido por fecha (lo trabajado en las evoluciones firmadas de ese día). */
  tratamientos: Record<string, string>;
}) {
  const [estado, accion, enviando] = useActionState<EstadoConstancia, FormData>(emitirConstancia, {
    errores: {}, mensaje: null, exitos: 0, valores: {},
  });
  const v = estado.valores;
  const [tipo, setTipo] = useState(v.tipo || "atencion");
  // Remontado tras cada envío: fecha y tratamiento vuelven a lo que devolvió el servidor.
  return (
    <CuerpoConstancia key={`${estado.exitos}-${JSON.stringify(v)}`} {...{ pacienteId, hoy, tratamientos, estado, accion, enviando, tipo, setTipo }} />
  );
}

function CuerpoConstancia({ pacienteId, hoy, tratamientos, estado, accion, enviando, tipo, setTipo }: {
  pacienteId: string; hoy: string; tratamientos: Record<string, string>; estado: EstadoConstancia;
  accion: (f: FormData) => void; enviando: boolean; tipo: string; setTipo: (t: string) => void;
}) {
  const v = estado.valores;
  const e = estado.errores;
  const [tratamiento, setTratamiento] = useState(v.tratamiento ?? tratamientos[v.fecha_atencion || hoy] ?? "");
  // Editado a mano: lo que volvió del servidor no está vacío y no es la sugerencia de esa fecha.
  const [editado, setEditado] = useState(!!v.tratamiento?.trim() && v.tratamiento !== tratamientos[v.fecha_atencion || hoy]);
  const campo = (c: string, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> & { inicial?: string }) => {
    const { inicial, ...resto } = props;
    return (
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor={`c-${c}`}>{etiqueta}</label>
        <input {...resto} id={`c-${c}`} name={c} defaultValue={v[c] ?? inicial ?? ""} aria-invalid={!!e[c]} className={ENTRADA} />
        {e[c] && <span className="text-xs font-normal text-red-700">{e[c]}</span>}
      </div>
    );
  };
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 font-medium text-gray-700">Documento</legend>
        {Object.entries(TIPOS_CONSTANCIA).map(([t, texto]) => (
          <label key={t} className="flex items-center gap-2">
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />{texto}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        {campo("fecha_atencion", "Fecha de atención", {
          type: "date", max: hoy, inicial: hoy,
          // Sin editar a mano, el tratamiento sigue a la fecha elegida.
          onChange: (ev) => { const f = ev.target.value; if (!editado) setTratamiento(tratamientos[f] ?? ""); },
        })}
        {campo("hora_inicio", "Desde (hora, opcional)", { type: "time" })}
        {campo("hora_fin", "Hasta (hora, opcional)", { type: "time" })}
      </div>
      {tipo === "descanso" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {campo("descanso_desde", "Descanso desde", { type: "date", inicial: hoy })}
          {campo("descanso_dias", "Días de descanso", { type: "number", min: 1, max: 30, inputMode: "numeric" })}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {campo("cie10", "Diagnóstico CIE-10 (opcional)", { placeholder: "p. ej. K08.1", maxLength: 6 })}
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="c-tratamiento">Tratamiento realizado{tipo === "descanso" ? "" : " (opcional)"}</label>
        <textarea id="c-tratamiento" name="tratamiento" rows={2} maxLength={500} value={tratamiento}
          onChange={(ev) => { const t = ev.target.value; setTratamiento(t); setEditado(true); }}
          aria-invalid={!!e.tratamiento} aria-describedby="c-tratamiento-ayuda" className={ENTRADA} />
        <span id="c-tratamiento-ayuda" className="text-xs font-normal text-gray-500">
          Se completa con lo trabajado en las evoluciones firmadas de esa fecha; puedes editarlo.
        </span>
        {e.tratamiento && <span className="text-xs font-normal text-red-700">{e.tratamiento}</span>}
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="c-observaciones">Observaciones (opcional)</label>
        <textarea id="c-observaciones" name="observaciones" rows={2} maxLength={500} defaultValue={v.observaciones ?? ""}
          className={ENTRADA} />
        {e.observaciones && <span className="text-xs font-normal text-red-700">{e.observaciones}</span>}
      </div>
      <p className="text-xs text-gray-500">El diagnóstico solo figura si lo escribes (el paciente puede preferir que no aparezca).</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Emitiendo…" : "Emitir documento"}</button>
        {(e.general || e.tipo) && <p role="alert" className="text-sm text-red-700">{e.general ?? e.tipo}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

export function AnularDocumento({ pacienteId, id, tabla, descripcion }: {
  pacienteId: string; id: string; tabla: "receta" | "constancia"; descripcion: string;
}) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(anularDocumento, { error: null, intento: 0 });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Anular</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="tabla" value={tabla} />
        <input name="motivo" maxLength={200} aria-label={`Motivo para anular ${descripcion}`} placeholder="Motivo"
          className="min-w-48 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        {estado.error && <p role="alert" className="w-full text-xs text-red-700">{estado.error}</p>}
      </form>
    </details>
  );
}

export function QuitarPlantilla({ pacienteId, id, nombre }: { pacienteId: string; id: string; nombre: string }) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(desactivarPlantillaReceta, { error: null, intento: 0 });
  return (
    <form action={accion} className="inline">
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={enviando} aria-label={`Quitar la plantilla ${nombre}`}
        className="text-xs text-gray-600 hover:underline">Quitar</button>
      {estado.error && <span role="alert" className="ml-2 text-xs text-red-700">{estado.error}</span>}
    </form>
  );
}
