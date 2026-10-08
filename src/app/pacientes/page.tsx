import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { formatearFecha } from "@/lib/fechas";
import { registrarError } from "@/lib/registro";
import { modulos } from "@/lib/funciones";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pacientes – Dental Demo" };

type Fila = {
  id: string; nombres: string; apellidos: string; tipo_documento: string; numero_documento: string | null;
  telefono: string | null; fecha_nacimiento: string | null;
};

export default async function Pacientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!modulos.pacientes) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);

  const supabase = await createClient();
  const { data, error } = q.length >= 2
    ? await supabase.rpc("buscar_pacientes", { texto: q, limite: 30 })
    : await supabase.from("paciente")
        .select("id, nombres, apellidos, tipo_documento, numero_documento, telefono, fecha_nacimiento")
        .is("anulado_at", null).order("created_at", { ascending: false }).limit(20);
  if (error) {
    registrarError("pacientes.listar", error);
    throw new Error("No se pudo cargar la lista de pacientes");
  }
  const filas = (data ?? []) as Fila[];

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Pacientes</h1>
          <Link href="/pacientes/nuevo" className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
            Nuevo paciente
          </Link>
        </div>

        <form role="search" className="mt-6 flex gap-2" action="/pacientes">
          <label htmlFor="q" className="sr-only">Buscar paciente</label>
          <input
            id="q" name="q" type="search" defaultValue={q} autoFocus autoComplete="off"
            placeholder="DNI, nombre o celular"
            className="w-full max-w-xl rounded-md border border-gray-300 px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
          <button type="submit" className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50">Buscar</button>
        </form>

        <p className="mt-4 text-sm text-gray-600">
          {q.length >= 2
            ? `${filas.length} ${filas.length === 1 ? "resultado" : "resultados"} para «${q}»`
            : q ? "Escribe al menos 2 caracteres." : "Últimos pacientes registrados"}
        </p>

        {filas.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {filas.map((p) => (
              <li key={p.id}>
                <Link href={`/pacientes/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-gray-50">
                  <span>
                    <span className="font-medium text-gray-900">{p.apellidos}, {p.nombres}</span>
                    <span className="block text-sm text-gray-500">
                      {p.numero_documento ? `${p.tipo_documento.toUpperCase()} ${p.numero_documento}` : "Sin documento"}
                      {p.fecha_nacimiento && ` · Nació el ${formatearFecha(p.fecha_nacimiento)}`}
                    </span>
                  </span>
                  {p.telefono && <span className="text-sm tabular-nums text-gray-600">{p.telefono.slice(2)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {q.length >= 2 && filas.length === 0 && (
          <p className="mt-3 rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
            No encontramos pacientes. <Link href="/pacientes/nuevo" className="font-medium text-teal-700 underline">Regístralo</Link>.
          </p>
        )}
      </main>
    </>
  );
}
