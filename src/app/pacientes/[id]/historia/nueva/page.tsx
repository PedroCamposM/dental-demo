import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria, COLUMNAS_VERSION, puedeGestar, type Version } from "../../datos-clinicos";
import type { ValoresCuestionario } from "../acciones";
import { FormularioCuestionario } from "./formulario";

export const metadata: Metadata = { title: "Actualizar historia clínica – Dental Demo" };

export default async function NuevaVersion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sesion, paciente } = await abrirHistoria(id);
  if (paciente.anulado_at) notFound();
  const supabase = await createClient();
  const { data: vigente, error } = await supabase.from("cuestionario_salud").select(COLUMNAS_VERSION).eq("paciente_id", id)
    .order("registrado_at", { ascending: false }).order("version", { ascending: false }).limit(1).maybeSingle<Version>();
  if (error) registrarError("historia.vigente", error, { paciente: id });

  // La versión nueva parte de la vigente: se revisa y se corrige lo que cambió.
  const inicial: ValoresCuestionario = vigente ? {
    textos: {
      motivo_consulta: "", enfermedad_actual: "",
      enfermedades_otras: vigente.enfermedades_otras ?? "", cirugias: vigente.cirugias ?? "",
      hospitalizaciones: vigente.hospitalizaciones ?? "", medicacion: vigente.medicacion ?? "",
      anticoagulado: vigente.anticoagulado ? "1" : "", anticoagulante: vigente.anticoagulante ?? "",
      alergias: vigente.alergias.join("\n"), embarazo: vigente.embarazo === "no_aplica" ? "no" : vigente.embarazo,
      semanas_gestacion: vigente.semanas_gestacion?.toString() ?? "", lactancia: vigente.lactancia ? "1" : "",
      habitos_otros: vigente.habitos_otros ?? "", antecedentes_odontologicos: vigente.antecedentes_odontologicos ?? "",
      observaciones: "",
    },
    listas: { enfermedades: vigente.enfermedades, habitos: vigente.habitos },
  } : { textos: {}, listas: {} };

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href={`/pacientes/${id}/historia`} className="text-sm font-medium text-teal-700 hover:underline">
          ← Historia clínica
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{paciente.nombres} {paciente.apellidos}</h1>
        <p className="mb-6 text-gray-600">
          {vigente
            ? `Versión nueva a partir de la versión ${vigente.version}. La anterior se conserva sin cambios.`
            : "Primera versión de la historia clínica."}
        </p>
        <FormularioCuestionario pacienteId={id} puedeGestar={puedeGestar(paciente)} inicial={inicial} />
      </main>
    </>
  );
}
