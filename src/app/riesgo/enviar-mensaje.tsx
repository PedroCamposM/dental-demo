"use client";

import { useState, useTransition } from "react";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Destino } from "@/lib/tablero/mensajes";
import { registrarMensaje } from "./acciones";

type Props = {
  telefono: string | null;
  textoInicial: string;
  destino: Destino;
  plantillaId: string | null;
  /** Fecha legible del último envío de este tipo al paciente, si hubo uno reciente. */
  ultimoEnvio: string | null;
};

export function EnviarMensaje({ telefono, textoInicial, destino, plantillaId, ultimoEnvio }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(textoInicial);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [registrando, iniciar] = useTransition();

  if (!telefono) {
    return <p className="text-sm text-gray-500">Sin teléfono registrado</p>;
  }

  function enviar() {
    if (!telefono) return;
    // Se abre en el mismo clic para que el navegador no bloquee la ventana.
    window.open(enlaceWhatsApp(telefono, texto), "_blank", "noopener,noreferrer");
    iniciar(async () => {
      const r = await registrarMensaje(destino, plantillaId, texto);
      setEstado(r.ok ? { tipo: "ok", texto: "Registrado en seguimiento" } : { tipo: "error", texto: r.error });
      if (r.ok) setAbierto(false);
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {ultimoEnvio && !estado && <span className="text-xs text-gray-500">Enviado el {ultimoEnvio}</span>}
        {estado && (
          <span role="status" className={`text-xs ${estado.tipo === "ok" ? "text-teal-700" : "text-red-700"}`}>
            {estado.texto}
          </span>
        )}
        <button
          type="button"
          onClick={() => setAbierto((x) => !x)}
          aria-expanded={abierto}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          Enviar mensaje
        </button>
      </div>
      {abierto && (
        <div className="flex w-full flex-col gap-2 sm:w-96">
          <label className="text-xs font-medium text-gray-600">
            Mensaje (puedes editarlo antes de enviar)
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm font-normal text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </label>
          <button
            type="button"
            onClick={enviar}
            disabled={registrando || !texto.trim()}
            className="self-end rounded-md border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60"
          >
            {registrando ? "Registrando…" : "Abrir WhatsApp"}
          </button>
        </div>
      )}
    </div>
  );
}
