import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { fechaLima, formatearFecha, horaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";
import { FormularioExportar } from "./formulario";

export const metadata: Metadata = { title: "Exportar historia clínica – Dental Demo" };

/** Exportar la historia clínica completa: se pide el motivo y queda en la auditoría. */
export default async function Exportar({ params }: { params: Promise<{ id: string }> }) {
  if (!modulos.etapa11) notFound();
  const { id } = await params;
  const { sesion, paciente } = await abrirHistoria(id);
  if (!sesion.esDentista) redirect(`/pacientes/${id}`);
  const supabase = await createClient();
  const [previas, equipo] = await Promise.all([
    supabase.from("exportacion_historia").select("id, usuario_id, motivo, creada_at").eq("paciente_id", id)
      .order("creada_at", { ascending: false }).limit(50)
      .returns<{ id: string; usuario_id: string; motivo: string; creada_at: string }[]>(),
    supabase.from("usuario").select("id, nombre").returns<{ id: string; nombre: string }[]>(),
  ]);
  if (previas.error) registrarError("historia.exportaciones", previas.error, { paciente: id });
  const nombre = new Map((equipo.data ?? []).map((u) => [u.id, u.nombre]));
  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href={`/pacientes/${id}`} className="text-sm font-medium text-teal-700 hover:underline">← Ficha del paciente</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="filiacion" veClinico={sesion.veClinico} />
        <section aria-labelledby="t-exportar" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="t-exportar" className="text-lg font-semibold">Exportar historia clínica completa</h2>
          <p className="mb-3 mt-1 text-sm text-gray-600">
            Incluye filiación, historia y sus versiones, odontogramas, diagnósticos, planes, evoluciones firmadas con
            sus adendas, consentimientos y recetas. Se abre como documento para imprimir o guardar en PDF. La
            exportación queda registrada con tu nombre, la fecha y el motivo.
          </p>
          <FormularioExportar pacienteId={id} />
        </section>
        <section aria-labelledby="t-previas" className="mt-6">
          <h2 id="t-previas" className="text-lg font-semibold">Exportaciones anteriores</h2>
          {(previas.data ?? []).length === 0 ? <p className="mt-2 text-sm text-gray-500">Aún no se ha exportado.</p> : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm">
              {(previas.data ?? []).map((e) => (
                <li key={e.id} className="px-4 py-2">
                  {formatearFecha(fechaLima(e.creada_at))} {horaLima(e.creada_at)} · {nombre.get(e.usuario_id) ?? "—"} · {e.motivo}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
