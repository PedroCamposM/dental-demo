import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { FormularioFusion, type Candidato } from "./formulario";

export const metadata: Metadata = { title: "Fusionar pacientes – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fila = {
  id: string; nombres: string; apellidos: string; tipo_documento: string; numero_documento: string | null;
  telefono: string | null; fecha_nacimiento: string | null;
};

const detalle = (p: Fila) => [
  p.numero_documento ? `${p.tipo_documento.toUpperCase()} ${p.numero_documento}` : "Sin documento",
  p.fecha_nacimiento ? `nació el ${formatearFecha(p.fecha_nacimiento)}` : null,
  p.telefono ? `cel. ${p.telefono.slice(2)}` : null,
].filter(Boolean).join(" · ");

export default async function Fusionar({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id) || !modulos.etapa1) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (sesion.rol !== "admin") redirect(`/pacientes/${id}`);

  const supabase = await createClient();
  const { data: p, error } = await supabase.from("paciente")
    .select("id, nombres, apellidos, tipo_documento, numero_documento, telefono, fecha_nacimiento, anulado_at")
    .eq("id", id).maybeSingle<Fila & { anulado_at: string | null }>();
  if (error) {
    registrarError("pacientes.fusionar.cargar", error, { paciente: id });
    throw new Error("No se pudo cargar el paciente");
  }
  if (!p || p.anulado_at) notFound();

  const q = ((await searchParams).q ?? `${p.nombres} ${p.apellidos}`).trim().slice(0, 80);
  const { data: resultados } = await supabase.rpc("buscar_pacientes", { texto: q, limite: 20 });
  const candidatos: Candidato[] = ((resultados ?? []) as Fila[])
    .filter((c) => c.id !== id)
    .map((c) => ({ id: c.id, nombre: `${c.apellidos}, ${c.nombres}`, detalle: detalle(c) }));

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href={`/pacientes/${id}`} className="text-sm font-medium text-teal-700 hover:underline">← Volver a la ficha</Link>
        <h1 className="mt-3 text-2xl font-semibold">Fusionar registros duplicados</h1>
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm text-teal-900">Se conserva este paciente:</p>
          <p className="font-medium">{p.apellidos}, {p.nombres}</p>
          <p className="text-sm text-gray-600">{detalle(p)}</p>
        </div>
        <p className="mt-4 text-sm text-gray-600">
          Los planes, notas, odontogramas, citas y seguimientos del duplicado pasan a este paciente. El duplicado no se
          borra: queda anulado con el motivo y la fusión se registra en la auditoría.
        </p>

        <form className="mt-6 flex gap-2" action={`/pacientes/${id}/fusionar`}>
          <label htmlFor="q" className="sr-only">Buscar el duplicado</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="DNI, nombre o celular"
            className="w-full rounded-md border border-gray-300 px-3 py-2" />
          <button type="submit" className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50">Buscar</button>
        </form>

        <div className="mt-4">
          {candidatos.length === 0
            ? <p className="text-gray-600">No hay otros registros que coincidan. Busca por documento, nombre o celular.</p>
            : <FormularioFusion conservar={id} candidatos={candidatos} />}
        </div>
      </main>
    </>
  );
}
