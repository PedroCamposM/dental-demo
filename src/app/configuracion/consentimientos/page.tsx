import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { TIPOS_PLANTILLA, type TipoPlantilla } from "@/lib/clinico/consentimientos";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { NavegacionConfiguracion } from "../navegacion";

export const metadata: Metadata = { title: "Plantillas de consentimiento – Dental Demo" };

type Plantilla = { id: string; tipo: TipoPlantilla; nombre: string; es_ejemplo: boolean; activa: boolean; updated_at: string };

export default async function PlantillasConsentimiento({ searchParams }: { searchParams: Promise<{ guardada?: string }> }) {
  if (!modulos.etapa7) notFound();
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") redirect("/");
  const { guardada } = await searchParams;
  const supabase = await createClient();
  const [plantillas, procedimientos] = await Promise.all([
    supabase.from("plantilla_consentimiento").select("id, tipo, nombre, es_ejemplo, activa, updated_at").order("nombre")
      .returns<Plantilla[]>(),
    supabase.from("procedimiento").select("codigo, nombre, requiere_consentimiento, consentimiento_plantilla_id")
      .eq("activo", true).order("codigo")
      .returns<{ codigo: string; nombre: string; requiere_consentimiento: boolean; consentimiento_plantilla_id: string | null }[]>(),
  ]);
  const error = plantillas.error ?? procedimientos.error;
  if (error) registrarError("plantillas.listar", error);
  const usos = new Map<string, string[]>();
  for (const p of procedimientos.data ?? []) {
    if (p.consentimiento_plantilla_id) usos.set(p.consentimiento_plantilla_id, [...(usos.get(p.consentimiento_plantilla_id) ?? []), p.codigo]);
  }
  const sinPlantilla = (procedimientos.data ?? []).filter((p) => p.requiere_consentimiento && !p.consentimiento_plantilla_id);
  const ejemplos = (plantillas.data ?? []).filter((p) => p.es_ejemplo && p.activa).length;

  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Configuración de la clínica</h1>
        <NavegacionConfiguracion actual="consentimientos" />
        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm text-gray-600">
            Textos de los consentimientos informados (NTS 139, formato 16). El paciente o su representante firma a mano el formato
            impreso. Los procedimientos que requieren consentimiento apuntan a su plantilla en «Procedimientos y aranceles».
          </p>
          <Link href="/configuracion/consentimientos/nueva" className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
            Nueva plantilla
          </Link>
        </div>
        {guardada && <p role="status" className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">Plantilla «{guardada}» guardada.</p>}
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}
        {ejemplos > 0 && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {ejemplos === 1 ? "Hay 1 plantilla de ejemplo" : `Hay ${ejemplos} plantillas de ejemplo`} sin revisar: sus formatos se imprimen
            con un aviso hasta que la clínica revise el texto y lo apruebe.
          </p>
        )}
        {sinPlantilla.length > 0 && (
          <p className="mt-4 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            Requieren consentimiento y no tienen plantilla asignada (se elige al generar):{" "}
            {sinPlantilla.map((p) => `${p.codigo} ${p.nombre}`).join(" · ")}
          </p>
        )}
        <ul className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {(plantillas.data ?? []).map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${p.activa ? "" : "opacity-60"}`}>
              <div>
                <Link href={`/configuracion/consentimientos/${p.id}`} className="font-medium text-teal-800 hover:underline">{p.nombre}</Link>
                <p className="text-sm text-gray-600">
                  {TIPOS_PLANTILLA[p.tipo]}{usos.get(p.id) ? ` · ${usos.get(p.id)?.join(", ")}` : ""}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                {p.es_ejemplo && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">Ejemplo sin revisar</span>}
                {!p.activa && <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">Inactiva</span>}
              </div>
            </li>
          ))}
          {(plantillas.data ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Aún no hay plantillas.</li>}
        </ul>
      </main>
    </>
  );
}
