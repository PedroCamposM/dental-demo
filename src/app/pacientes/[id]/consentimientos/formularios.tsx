"use client";

import { useActionState, useState, useTransition } from "react";
import { revisarArchivo, rutaArchivo, type Mime } from "@/lib/clinico/archivos";
import { FINES_IMAGEN } from "@/lib/clinico/consentimientos";
import { createClient } from "@/lib/supabase/client";
import { cambiarConsentimiento, generarConsentimiento, registrarFirma, type EstadoSimple } from "./acciones";

const ENTRADA =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";
const BOTON = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60";
const INICIAL: EstadoSimple = { error: null, mensaje: null, intento: 0, exitos: 0 };

function Mensajes({ estado }: { estado: EstadoSimple }) {
  return (
    <>
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="text-sm text-teal-700">{estado.mensaje}</p>}
    </>
  );
}

export type OpcionItem = { id: string; texto: string; plantillaId: string | null; requiere: boolean };
export type OpcionPlantilla = { id: string; nombre: string; ejemplo: boolean };

/** Generar el formato de consentimiento de un procedimiento del plan. */
export function GenerarProcedimiento({ pacienteId, items, plantillas, itemInicial }: {
  pacienteId: string; items: OpcionItem[]; plantillas: OpcionPlantilla[]; itemInicial?: string;
}) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(generarConsentimiento, INICIAL);
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0
        ? <p className="text-sm text-gray-500">No hay procedimientos pendientes sin consentimiento en los planes del paciente.</p>
        // La `key` vuelve a elegir el primer ítem pendiente después de cada formato generado.
        : <CuerpoGenerar key={estado.exitos} pacienteId={pacienteId} items={items} plantillas={plantillas}
            itemInicial={estado.exitos === 0 ? itemInicial : undefined} accion={accion} enviando={enviando} />}
      <Mensajes estado={estado} />
    </div>
  );
}

function CuerpoGenerar({ pacienteId, items, plantillas, itemInicial, accion, enviando }: {
  pacienteId: string; items: OpcionItem[]; plantillas: OpcionPlantilla[]; itemInicial?: string;
  accion: (f: FormData) => void; enviando: boolean;
}) {
  const [itemId, setItemId] = useState((items.find((i) => i.id === itemInicial) ?? items[0])?.id ?? "");
  const [plantillaLibre, setPlantillaLibre] = useState("");
  const item = items.find((i) => i.id === itemId);
  // Si el catálogo asigna la plantilla al procedimiento, se usa esa (la base lo exige igual).
  const fija = item?.plantillaId ? plantillas.find((p) => p.id === item.plantillaId) : undefined;
  return (
    <form action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="tipo" value="procedimiento" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="g-item">Procedimiento del plan</label>
          <select id="g-item" name="item_plan_id" value={itemId} onChange={(e) => { setItemId(e.target.value); setPlantillaLibre(""); }}
            className={ENTRADA}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.texto}{i.requiere ? " · requiere consentimiento" : ""}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          <label htmlFor="g-plantilla">Plantilla</label>
          {fija ? (
            <>
              <input type="hidden" name="plantilla_id" value={fija.id} />
              <select id="g-plantilla" value={fija.id} disabled className={ENTRADA}>
                <option value={fija.id}>{fija.nombre}{fija.ejemplo ? " (ejemplo sin revisar)" : ""}</option>
              </select>
              <span className="text-xs font-normal text-gray-500">La asigna el catálogo de procedimientos.</span>
            </>
          ) : (
            <select id="g-plantilla" name="plantilla_id" value={plantillaLibre} onChange={(e) => setPlantillaLibre(e.target.value)}
              className={ENTRADA}>
              <option value="">Elegir…</option>
              {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.ejemplo ? " (ejemplo sin revisar)" : ""}</option>)}
            </select>
          )}
        </div>
      </div>
      <div>
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Generando…" : "Generar formato"}</button>
      </div>
    </form>
  );
}

/** Generar el consentimiento de uso de imagen (separado y opcional). */
export function GenerarUsoImagen({ pacienteId, plantillas }: { pacienteId: string; plantillas: OpcionPlantilla[] }) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(generarConsentimiento, INICIAL);
  if (plantillas.length === 0) {
    return <p className="text-sm text-gray-500">La clínica no tiene plantilla de uso de imagen activa.</p>;
  }
  return (
    <form key={estado.exitos} action={accion} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="paciente_id" value={pacienteId} />
      <input type="hidden" name="tipo" value="uso_imagen" />
      <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        <label htmlFor="g-plantilla-imagen">Plantilla</label>
        <select id="g-plantilla-imagen" name="plantilla_id" defaultValue={plantillas[0]?.id} className={ENTRADA}>
          {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.ejemplo ? " (ejemplo sin revisar)" : ""}</option>)}
        </select>
      </div>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 font-medium text-gray-700">Fines que autoriza el paciente</legend>
        {Object.entries(FINES_IMAGEN).map(([v, t]) => (
          <label key={v} className="flex items-center gap-2"><input type="checkbox" name="fines" value={v} />{t}</label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enviando} className={BOTON}>{enviando ? "Generando…" : "Generar formato de uso de imagen"}</button>
        <Mensajes estado={estado} />
      </div>
    </form>
  );
}

/**
 * Registrar el formato firmado a mano (o la negativa): se sube el escaneo al bucket
 * privado desde el navegador y luego se registra en la base.
 */
export function RegistrarFirma({ clinicaId, pacienteId, id, titulo, hoy }: {
  clinicaId: string; pacienteId: string; id: string; titulo: string; hoy: string;
}) {
  const [estado, accion, guardando] = useActionState<EstadoSimple, FormData>(registrarFirma, INICIAL);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrorSubida(null);
    const datos = new FormData(ev.currentTarget);
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      setErrorSubida("Elige el escaneo o la foto del formato firmado.");
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
      setErrorSubida("No se pudo subir el escaneo. Revisa la conexión e inténtalo de nuevo.");
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
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-teal-700 hover:underline">Subir formato firmado</summary>
      <form onSubmit={enviar} className="mt-2 flex flex-col gap-3 rounded-lg border border-gray-200 p-3" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-1 font-medium text-gray-700">Decisión del paciente o su representante</legend>
          <label className="flex items-center gap-2"><input type="radio" name="decision" value="firmado" defaultChecked />Firmó y aceptó</label>
          <label className="flex items-center gap-2"><input type="radio" name="decision" value="negado" />Se negó (firmó la negativa)</label>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 font-medium text-gray-700">
            <label htmlFor={`f-fecha-${id}`}>Fecha de la firma</label>
            <input id={`f-fecha-${id}`} name="decidido" type="date" max={hoy} defaultValue={hoy} className={ENTRADA} />
          </div>
          <div className="flex flex-col gap-1 font-medium text-gray-700">
            <label htmlFor={`f-archivo-${id}`}>Escaneo o foto del formato (PDF o imagen)</label>
            <input id={`f-archivo-${id}`} name="archivo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
              aria-label={`Escaneo firmado de ${titulo}`} className="text-sm font-normal" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={subiendo || guardando} className={BOTON}>
            {subiendo ? "Subiendo…" : guardando ? "Guardando…" : "Registrar"}
          </button>
          {errorSubida ? <p role="alert" className="text-sm text-red-700">{errorSubida}</p> : <Mensajes estado={estado} />}
        </div>
      </form>
    </details>
  );
}

/** Revocar un consentimiento firmado o anular un formato pendiente (con motivo). */
export function CambiarConsentimiento({ pacienteId, id, accion: tipo, titulo }: {
  pacienteId: string; id: string; accion: "revocar" | "anular"; titulo: string;
}) {
  const [estado, accion, enviando] = useActionState<EstadoSimple, FormData>(cambiarConsentimiento, INICIAL);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-600 hover:underline">{tipo === "revocar" ? "Registrar revocación" : "Anular formato"}</summary>
      <form key={estado.intento} action={accion} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="paciente_id" value={pacienteId} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="accion" value={tipo} />
        <input name="motivo" maxLength={tipo === "revocar" ? 300 : 200} aria-label={`Motivo para ${tipo} ${titulo}`}
          placeholder={tipo === "revocar" ? "Lo que expresó el paciente" : "p. ej. se generó con la plantilla equivocada"}
          className="min-w-64 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" disabled={enviando} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">
          {enviando ? "Guardando…" : "Confirmar"}
        </button>
        <div className="w-full"><Mensajes estado={estado} /></div>
      </form>
    </details>
  );
}
