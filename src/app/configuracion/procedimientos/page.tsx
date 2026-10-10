import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { ESPECIALIDADES, formatearDuracion, type Especialidad } from "@/lib/catalogo/validacion";
import { formatearSoles } from "@/lib/dinero";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { NavegacionConfiguracion } from "../navegacion";
import { COLUMNAS_PROCEDIMIENTO, sesionAdminCatalogo, type Procedimiento } from "./datos";

export const metadata: Metadata = { title: "Procedimientos y aranceles – Dental Demo" };

export default async function Procedimientos({
  searchParams,
}: { searchParams: Promise<{ guardado?: string; inactivos?: string }> }) {
  const sesion = await sesionAdminCatalogo();
  const { guardado, inactivos } = await searchParams;
  const verInactivos = inactivos === "1";

  const supabase = await createClient();
  const { data, error } = await supabase.from("procedimiento").select(COLUMNAS_PROCEDIMIENTO)
    .order("codigo").returns<Procedimiento[]>();
  if (error) registrarError("catalogo.listar", error);
  const todos = data ?? [];
  const lista = verInactivos ? todos : todos.filter((p) => p.activo);
  const cantidadInactivos = todos.length - todos.filter((p) => p.activo).length;
  const grupos = (Object.keys(ESPECIALIDADES) as Especialidad[])
    .map((esp) => ({ esp, items: lista.filter((p) => p.especialidad === esp) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Configuración de la clínica</h1>
        <NavegacionConfiguracion actual="procedimientos" />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm text-gray-600">
            Los planes de tratamiento toman de aquí el precio y la duración; el odontólogo los puede ajustar en cada
            plan. Los procedimientos no se borran: se desactivan.
          </p>
          <Link href="/configuracion/procedimientos/nuevo"
            className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
            Nuevo procedimiento
          </Link>
        </div>

        {guardado && (
          <p role="status" className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
            Procedimiento {guardado} guardado.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No se pudo cargar el catálogo. Recarga la página.
          </p>
        )}

        {!error && grupos.length === 0 && (
          <p className="mt-8 rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
            Aún no hay procedimientos. Agrega el primero con «Nuevo procedimiento».
          </p>
        )}

        {grupos.map(({ esp, items }) => (
          <section key={esp} aria-labelledby={`esp-${esp}`} className="mt-8">
            <h2 id={`esp-${esp}`} className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              {ESPECIALIDADES[esp]}
            </h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Código</th>
                    <th scope="col" className="px-4 py-2 font-medium">Procedimiento</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Precio base</th>
                    <th scope="col" className="px-4 py-2 font-medium">Duración</th>
                    <th scope="col" className="px-4 py-2 font-medium">Consentimiento</th>
                    <th scope="col" className="px-4 py-2 font-medium">Control</th>
                    <th scope="col" className="px-4 py-2"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((p) => (
                    <tr key={p.id} className={p.activo ? "" : "text-gray-400"}>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{p.codigo}</td>
                      <td className="px-4 py-2">
                        {p.nombre}
                        {!p.activo && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">Inactivo</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{formatearSoles(p.precio_base_centimos)}</td>
                      <td className="whitespace-nowrap px-4 py-2">{formatearDuracion(p.duracion_minutos)}</td>
                      <td className="px-4 py-2">{p.requiere_consentimiento ? "Sí" : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {p.control_dias === null ? "—" : `A los ${p.control_dias} ${p.control_dias === 1 ? "día" : "días"}`}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/configuracion/procedimientos/${p.id}`} className="font-medium text-teal-700 hover:underline"
                          aria-label={`Editar ${p.nombre}`}>
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {cantidadInactivos > 0 && (
          <p className="mt-6 text-sm">
            <Link href={verInactivos ? "/configuracion/procedimientos" : "/configuracion/procedimientos?inactivos=1"}
              className="font-medium text-teal-700 hover:underline">
              {verInactivos ? "Ocultar inactivos" : `Mostrar inactivos (${cantidadInactivos})`}
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
