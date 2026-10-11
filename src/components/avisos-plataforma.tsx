"use client";

import { useEffect, useState } from "react";

export type AvisoPlataforma = { id: string; texto: string; nivel: "info" | "importante" };

const CLAVE = "dd_avisos_cerrados";

function leerCerrados(): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Avisos de la plataforma (Etapa 20). Los informativos se pueden cerrar en este navegador; los importantes, no. */
export function AvisosPlataforma({ avisos }: { avisos: AvisoPlataforma[] }) {
  const [cerrados, setCerrados] = useState<string[] | null>(null);
  useEffect(() => setCerrados(leerCerrados()), []);
  const visibles = avisos.filter((a) => a.nivel === "importante" || (cerrados !== null && !cerrados.includes(a.id)));
  if (visibles.length === 0) return null;
  const cerrar = (id: string) => {
    const nuevos = [...(cerrados ?? []), id].slice(-50);
    setCerrados(nuevos);
    try { window.localStorage.setItem(CLAVE, JSON.stringify(nuevos)); } catch { /* sin almacenamiento: solo se oculta ahora */ }
  };
  return (
    <div>
      {visibles.map((a) => (
        <p key={a.id} role={a.nivel === "importante" ? "alert" : "status"}
          className={`flex flex-wrap items-center justify-center gap-3 px-4 py-2 text-center text-sm ${
            a.nivel === "importante" ? "bg-amber-50 text-amber-900" : "bg-sky-50 text-sky-900"}`}>
          <span><span className="font-medium">Aviso de Dental Demo:</span> {a.texto}</span>
          {a.nivel === "info" && (
            <button type="button" onClick={() => cerrar(a.id)} className="rounded-md border border-sky-300 px-2 py-0.5 text-xs hover:bg-sky-100">
              Entendido
            </button>
          )}
        </p>
      ))}
    </div>
  );
}
