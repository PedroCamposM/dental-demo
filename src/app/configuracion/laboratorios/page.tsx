import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { NavegacionConfiguracion } from "../navegacion";
import { ActivarLaboratorio, NuevoLaboratorio } from "./formularios";

export const metadata: Metadata = { title: "Laboratorios – Dental Demo" };

type Laboratorio = { id: string; nombre: string; telefono: string | null; contacto: string | null; activo: boolean };

/** Laboratorios con los que trabaja la clínica (solo administrador). */
export default async function Laboratorios() {
  if (!modulos.etapa10) notFound();
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") redirect("/");
  const supabase = await createClient();
  const { data, error } = await supabase.from("laboratorio").select("id, nombre, telefono, contacto, activo")
    .order("activo", { ascending: false }).order("nombre").returns<Laboratorio[]>();
  if (error) registrarError("laboratorio.listar", error);
  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Configuración de la clínica</h1>
        <NavegacionConfiguracion actual="laboratorios" />
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar la lista. Recarga la página.</p>}
        <section aria-labelledby="t-nuevo" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="t-nuevo" className="mb-3 text-lg font-semibold">Agregar laboratorio</h2>
          <NuevoLaboratorio />
        </section>
        <section aria-labelledby="t-lista" className="mt-6">
          <h2 id="t-lista" className="text-lg font-semibold">Laboratorios</h2>
          {(data ?? []).length === 0 ? <p className="mt-2 text-sm text-gray-500">Aún no hay laboratorios.</p> : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm">
              {(data ?? []).map((l) => (
                <li key={l.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 ${l.activo ? "" : "text-gray-400"}`}>
                  <span>
                    <span className="font-medium">{l.nombre}</span>
                    {l.telefono && <> · {l.telefono}</>}{l.contacto && <> · {l.contacto}</>}
                    {!l.activo && <> · inactivo</>}
                  </span>
                  <ActivarLaboratorio id={l.id} nombre={l.nombre} activo={l.activo} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-gray-500">Un laboratorio inactivo no se ofrece en órdenes nuevas; sus órdenes anteriores se conservan.</p>
        </section>
      </main>
    </>
  );
}
