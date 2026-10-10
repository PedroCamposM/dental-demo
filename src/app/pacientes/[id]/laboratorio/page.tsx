import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { NuevaOrden } from "@/app/laboratorio/componentes";
import { COLUMNAS_ORDEN, ListaOrdenes, type Orden } from "@/app/laboratorio/lista";
import { abrirHistoria } from "../datos-clinicos";
import { PestanasPaciente } from "../pestanas";

export const metadata: Metadata = { title: "Laboratorio – Dental Demo" };

type Item = { id: string; procedimiento: string; pieza: number | null; estado: string };

/** Órdenes de laboratorio del paciente, vinculadas a los ítems de su plan. */
export default async function LaboratorioPaciente({ params }: { params: Promise<{ id: string }> }) {
  if (!modulos.etapa10) notFound();
  const { id } = await params;
  const { sesion, paciente } = await abrirHistoria(id);
  const supabase = await createClient();
  const [ordenes, planes, labs] = await Promise.all([
    supabase.from("orden_laboratorio").select(COLUMNAS_ORDEN).eq("paciente_id", id).order("created_at", { ascending: false })
      .returns<Orden[]>(),
    supabase.from("plan_tratamiento").select("id").eq("paciente_id", id).in("estado", ["aceptado", "en_curso", "detenido", "terminado"])
      .returns<{ id: string }[]>(),
    supabase.from("laboratorio").select("id, nombre").eq("activo", true).order("nombre").returns<{ id: string; nombre: string }[]>(),
  ]);
  const ids = (planes.data ?? []).map((p) => p.id);
  const items = ids.length > 0
    ? await supabase.from("item_plan").select("id, procedimiento, pieza, estado").in("plan_id", ids)
        .in("estado", ["aceptado", "programado", "realizado"]).order("orden").returns<Item[]>()
    : { data: [] as Item[], error: null };
  const error = ordenes.error ?? planes.error ?? labs.error ?? items.error;
  if (error) registrarError("laboratorio.paciente", error, { paciente: id });
  const opciones = (items.data ?? []).map((i) => ({
    id: i.id, descripcion: `${i.procedimiento}${i.pieza ? ` · pieza ${i.pieza}` : ""}${i.estado === "realizado" ? " (realizado)" : ""}`,
  }));

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <PestanasPaciente id={id} actual="laboratorio" veClinico={sesion.veClinico} />
        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo cargar todo. Recarga la página.</p>}

        {sesion.esDentista && !paciente.anulado_at && (
          <section aria-labelledby="t-nueva" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-nueva" className="mb-3 text-lg font-semibold">Nueva orden de laboratorio</h2>
            {opciones.length === 0 ? <p className="text-sm text-gray-500">El paciente no tiene ítems aceptados en su plan.</p>
              : (labs.data ?? []).length === 0 ? <p className="text-sm text-gray-500">No hay laboratorios activos: el administrador los agrega en Configuración.</p>
              : <NuevaOrden pacienteId={id} items={opciones} laboratorios={labs.data ?? []} />}
          </section>
        )}

        <section aria-labelledby="t-ordenes" className="mt-6">
          <h2 id="t-ordenes" className="text-lg font-semibold">Órdenes</h2>
          {(ordenes.data ?? []).length === 0 ? <p className="mt-2 text-sm text-gray-500">Aún no hay órdenes de laboratorio.</p> : (
            <div className="mt-2"><ListaOrdenes ordenes={ordenes.data ?? []} hoy={fechaLima(new Date())} conPaciente={false} /></div>
          )}
        </section>
      </main>
    </>
  );
}
