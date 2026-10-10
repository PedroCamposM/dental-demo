"use client";

import { useActionState, useState, useTransition } from "react";
import { revisarArchivo, rutaArchivo, type Mime } from "@/lib/clinico/archivos";
import { TIPOS_INTERCONSULTA } from "@/lib/clinico/interconsultas";
import { createClient } from "@/lib/supabase/client";
import {
  cancelarInterconsulta, pedirInterconsulta, responderInterconsulta,
  type EstadoInterconsulta, type EstadoSimple,
} from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const INICIAL_SIMPLE: EstadoSimple = { error: null, mensaje: null, intento: 0 };

export type OpcionProfesional = { id: string; nombre: string };
export type OpcionSesion = { id: string; texto: string };

export function PedirInterconsulta({ pacienteId, profesionales, sesiones }: {
  pacienteId: string; profesionales: OpcionProfesional[]; sesiones: OpcionSesion[];
}) {
  const [estado, accion, enviando] = useActionState<EstadoInterconsulta, FormData>(pedirInterconsulta, {
    errores: {}, mensaje: null, exitos: 0, valores: {},
  });
  const v = estado.valores;
  const e = estado.errores;
  const [tipo, setTipo] = useState(v.tipo || (profesionales.length > 0 ? "interna" : "externa"));
  return (
    <form key={`${estado.exitos}-${JSON.stringify(v)}`} action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 font-medium text-gray-700">Tipo</legend>
        {Object.entries(TIPOS_INTERCONSULTA).map(([t, texto]) => (
          <label key={t} className="flex items-center gap-2">
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)}
              disabled={t === "interna" && profesionales.length === 0} />{texto}
          </label>
        ))}
      </fieldset>
      {tipo === "interna" ? (
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="i-destinatario">Profesional</label>
          <select id="i-destinatario" name="destinatario_id" defaultValue={v.destinatario_id ?? ""} aria-invalid={!!e.destinatario_id}
            className={ENTRADA}>
            <option value="">Elegir…</option>
            {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {e.destinatario_id && <span className="text-xs font-normal text-red-700">{e.destinatario_id}</span>}
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="i-destino">Se deriva a</label>
          <input id="i-destino" name="destino" maxLength={200} defaultValue={v.destino ?? ""} aria-invalid={!!e.destino}
            placeholder="p. ej. Cardiología, Hospital Regional Docente de Trujillo" className={ENTRADA} />
          {e.destino && <span className="text-xs font-normal text-red-700">{e.destino}</span>}
        </div>
      )}
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="i-motivo">Motivo de la interconsulta</label>
        <textarea id="i-motivo" name="motivo" rows={2} maxLength={1000} defaultValue={v.motivo ?? ""} aria-invalid={!!e.motivo}
          className={ENTRADA} />
        {e.motivo && <span className="text-xs font-normal text-red-700">{e.motivo}</span>}
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="i-datos">Datos clínicos relevantes (opcional)</label>
        <textarea id="i-datos" name="datos_clinicos" rows={3} maxLength={2000} defaultValue={v.datos_clinicos ?? ""}
          aria-invalid={!!e.datos_clinicos} className={ENTRADA} />
        {e.datos_clinicos && <span className="text-xs font-normal text-red-700">{e.datos_clinicos}</span>}
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="i-sesion">Sesión (opcional)</label>
        <select id="i-sesion" name="nota_id" defaultValue={v.nota_id ?? ""} className={ENTRADA}>
          <option value="">Sin sesión</option>
          {sesiones.map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Guardando…" : "Registrar interconsulta"}</button>
        {(e.general || e.tipo) && <p role="alert" className="text-sm text-red-700">{e.general ?? e.tipo}</p>}
        {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

/** Responder: interna por escrito; externa con el resultado y, si hay, el documento escaneado. */
export function Responder({ clinicaId, pacienteId, id, externa }: {
  clinicaId: string; pacienteId: string; id: string; externa: boolean;
}) {
  const [estado, accion, guardando] = useActionState<EstadoSimple, FormData>(responderInterconsulta, INICIAL_SIMPLE);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrorSubida(null);
    const datos = new FormData(ev.currentTarget);
    // Se valida antes de subir: un archivo subido no se puede borrar del bucket.
    if (String(datos.get("respuesta") ?? "").trim().length < 3) {
      setErrorSubida("Escribe la respuesta o el resultado.");
      return;
    }
    const archivo = datos.get("archivo");
    datos.delete("archivo");
    if (archivo instanceof File && archivo.size > 0) {
      const problema = revisarArchivo(archivo);
      if (problema) {
        setErrorSubida(problema);
        return;
      }
      const ruta = rutaArchivo(clinicaId, pacienteId, crypto.randomUUID(), archivo.type as Mime);
      setSubiendo(true);
      const { error } = await createClient().storage.from("clinico")
        .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
      setSubiendo(false);
      if (error) {
        setErrorSubida("No se pudo subir el documento. Revisa la conexión e inténtalo de nuevo.");
        return;
      }
      datos.set("ruta", ruta);
      datos.set("mime", archivo.type);
      datos.set("bytes", String(archivo.size));
      datos.set("nombre", archivo.name);
    }
    iniciar(() => accion(datos));
  }

  return (
    <details className="text-sm" open={!externa}>
      <summary className="cursor-pointer font-medium text-teal-700 hover:underline">
        {externa ? "Registrar el resultado" : "Responder"}
      </summary>
      <form onSubmit={enviar} className="mt-2 flex flex-col gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <textarea name="respuesta" rows={3} maxLength={2000} aria-label="Respuesta o resultado"
          placeholder={externa ? "p. ej. riesgo quirúrgico e indicaciones del especialista" : "Tu evaluación e indicaciones"}
          className={ENTRADA} />
        {externa && (
          <label className="flex flex-col gap-1 font-medium text-gray-700">
            Documento de respuesta (opcional: PDF o imagen)
            <input name="archivo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm font-normal" />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={subiendo || guardando} className={BOTON}>
            {subiendo ? "Subiendo…" : guardando ? "Guardando…" : "Guardar respuesta"}
          </button>
          {(errorSubida ?? estado.error) && <p role="alert" className="text-sm text-red-700">{errorSubida ?? estado.error}</p>}
        </div>
      </form>
    </details>
  );
}

export function Cancelar({ pacienteId, id }: { pacienteId: string; id: string }) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(cancelarInterconsulta, INICIAL_SIMPLE);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Cancelar</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <input name="motivo" maxLength={200} aria-label="Motivo para cancelar la interconsulta" placeholder="Motivo"
          className="min-w-48 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Cancelando…" : "Confirmar"}
        </button>
        {estado.error && <p role="alert" className="w-full text-xs text-red-700">{estado.error}</p>}
      </form>
    </details>
  );
}
