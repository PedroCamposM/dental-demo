"use client";

import { useActionState, useState, useTransition } from "react";
import { revisarArchivo, rutaArchivo, TIPOS_ARCHIVO, type Mime } from "@/lib/clinico/archivos";
import { createClient } from "@/lib/supabase/client";
import { anularArchivo, registrarArchivo, type EstadoArchivo, type EstadoSimple } from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 aria-[invalid=true]:border-red-500";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";

export type OpcionSesion = { id: string; texto: string };

/**
 * Sube el archivo al bucket privado desde el navegador (la sesión del usuario y las
 * políticas de Storage deciden si puede) y luego lo registra en la historia.
 */
export function SubirArchivo({ clinicaId, pacienteId, hoy, sesiones }: {
  clinicaId: string; pacienteId: string; hoy: string; sesiones: OpcionSesion[];
}) {
  const [estado, accion, guardando] = useActionState<EstadoArchivo, FormData>(registrarArchivo, {
    errores: {}, mensaje: null, intento: 0, exitos: 0,
  });
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const e = estado.errores;
  const ocupado = subiendo || guardando;

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrorSubida(null);
    const form = ev.currentTarget;
    const datos = new FormData(form);
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      setErrorSubida("Elige el archivo.");
      return;
    }
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
      setErrorSubida("No se pudo subir el archivo. Revisa la conexión e inténtalo de nuevo.");
      return;
    }
    datos.delete("archivo");
    datos.set("ruta", ruta);
    datos.set("mime", archivo.type);
    datos.set("bytes", String(archivo.size));
    datos.set("nombre", archivo.name);
    iniciar(() => accion(datos));
  }

  return (
    // La `key` limpia el formulario después de cada envío correcto.
    <form key={estado.exitos} onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="a-archivo">Archivo (JPG, PNG, WEBP o PDF; hasta 10 MB)</label>
        <input id="a-archivo" name="archivo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-invalid={!!(errorSubida || e.archivo)} className="text-sm font-normal" />
        {e.archivo && <span className="text-xs font-normal text-red-700">{e.archivo}</span>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="a-tipo">Tipo</label>
          <select id="a-tipo" name="tipo" defaultValue="radiografia" aria-invalid={!!e.tipo} className={ENTRADA}>
            {Object.entries(TIPOS_ARCHIVO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          {e.tipo && <span className="text-xs font-normal text-red-700">{e.tipo}</span>}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="a-fecha">Fecha de la imagen</label>
          <input id="a-fecha" name="tomada_el" type="date" max={hoy} defaultValue={hoy} aria-invalid={!!e.tomada_el}
            className={ENTRADA} />
          {e.tomada_el && <span className="text-xs font-normal text-red-700">{e.tomada_el}</span>}
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="a-pieza">Pieza (opcional)</label>
          <input id="a-pieza" name="pieza" inputMode="numeric" maxLength={2} placeholder="p. ej. 36"
            aria-invalid={!!e.pieza} className={ENTRADA} />
          {e.pieza && <span className="text-xs font-normal text-red-700">{e.pieza}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="a-sesion">Sesión (opcional)</label>
        <select id="a-sesion" name="nota_id" defaultValue="" aria-invalid={!!e.nota_id} className={ENTRADA}>
          <option value="">Sin sesión</option>
          {sesiones.map((s) => <option key={s.id} value={s.id}>{s.texto}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="a-descripcion">Descripción (opcional)</label>
        <input id="a-descripcion" name="descripcion" maxLength={500} placeholder="p. ej. periapical de control"
          aria-invalid={!!e.descripcion} className={ENTRADA} />
        {e.descripcion && <span className="text-xs font-normal text-red-700">{e.descripcion}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={ocupado} className={BOTON}>
          {subiendo ? "Subiendo…" : guardando ? "Guardando…" : "Guardar archivo"}
        </button>
        {(errorSubida ?? e.general) && <p role="alert" className="text-sm text-red-700">{errorSubida ?? e.general}</p>}
        {estado.mensaje && !errorSubida && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
      </div>
    </form>
  );
}

export function AnularArchivo({ pacienteId, id, descripcion }: { pacienteId: string; id: string; descripcion: string }) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(anularArchivo, {
    error: null, ok: false, intento: 0, texto: "",
  });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">Anular</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <input name="motivo" maxLength={200} defaultValue={estado.texto} aria-label={`Motivo para anular ${descripcion}`}
          placeholder="Motivo (p. ej. es de otro paciente)"
          className="min-w-48 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </button>
        {estado.error && <p role="alert" className="w-full text-xs text-red-700">{estado.error}</p>}
      </form>
    </details>
  );
}
