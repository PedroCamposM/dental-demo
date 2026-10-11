import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { detalleBitacora, NOMBRE_ACCION } from "@/lib/plataforma";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bitácora – Dental Demo" };

type Linea = { creada_at: string; autor: string | null; accion: string; clinica_id: string | null; clinica: string | null;
  detalle: Record<string, unknown> };

/** Lo que hizo el superadministrador (los últimos 300 cambios). */
export default async function Bitacora() {
  if (!modulos.etapa20) notFound();
  const supabase = await createClient();
  const { data: esSuper } = await supabase.rpc("es_superadmin");
  if (esSuper !== true) notFound();
  const { data, error } = await supabase.rpc("bitacora_plataforma", { limite: 300 });
  if (error) registrarError("plataforma.bitacora", error);
  const lineas = (data ?? []) as Linea[];
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/plataforma" className="text-sm text-teal-700 hover:underline">← Clínicas de la plataforma</Link>
      <h1 className="mt-2 text-2xl font-semibold">Bitácora del superadministrador</h1>
      <p className="text-sm text-gray-600">Cada cambio de planes, pagos, precios, descuentos, avisos, nombres y suspensiones, con fecha y autor.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">No se pudo cargar la bitácora. Vuelve a intentarlo.</p>}
      {lineas.length === 0 && !error ? <p className="mt-4 text-sm text-gray-600">Sin cambios registrados todavía.</p> : (
        <ul className="mt-4 flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white px-4 text-sm">
          {lineas.map((l, i) => (
            <li key={`${l.creada_at}-${i}`} className="py-2">
              <span className="font-medium">{NOMBRE_ACCION[l.accion] ?? l.accion}</span>
              {l.clinica_id && <> · <Link href={`/plataforma/clinicas/${l.clinica_id}`} className="text-teal-700 hover:underline">{l.clinica}</Link></>}
              {detalleBitacora(l.accion, l.detalle) && <span className="text-gray-700"> · {detalleBitacora(l.accion, l.detalle)}</span>}
              <span className="block text-xs text-gray-500">{fechaLima(l.creada_at)} {new Date(l.creada_at).toLocaleTimeString("es-PE",
                { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit" })}{l.autor ? ` · ${l.autor}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
