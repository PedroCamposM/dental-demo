import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertasPaciente } from "@/components/alertas-paciente";
import { Encabezado } from "@/components/encabezado";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { abrirHistoria, puedeGestar } from "../datos-clinicos";
import { FormularioAtencionRapida, type Previo } from "./formulario";

export const metadata: Metadata = { title: "Atención rápida – Dental Demo" };

export default async function AtencionRapida({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!modulos.etapa14) notFound();
  const { sesion, paciente } = await abrirHistoria(id);
  if (!sesion.esDentista || paciente.anulado_at) redirect(`/pacientes/${id}`);
  const supabase = await createClient();
  const [previo, procedimientos] = await Promise.all([
    supabase.from("cuestionario_salud").select("alergias, anticoagulado, anticoagulante, medicacion, embarazo")
      .eq("paciente_id", id).order("version", { ascending: false }).limit(1).maybeSingle<Previo>(),
    supabase.from("procedimiento").select("id, codigo, nombre, requiere_consentimiento").eq("activo", true).order("codigo")
      .returns<{ id: string; codigo: string; nombre: string; requiere_consentimiento: boolean }[]>(),
  ]);
  if (previo.error || procedimientos.error) registrarError("atencion_rapida.cargar", previo.error ?? procedimientos.error, { paciente: id });
  const lista = procedimientos.data ?? [];

  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <AlertasPaciente pacienteId={id} />
        <Link href={`/pacientes/${id}`} className="text-sm font-medium text-teal-700 hover:underline">← Ficha del paciente</Link>
        <h1 className="mt-3 text-2xl font-semibold">Atención rápida · {paciente.nombres} {paciente.apellidos}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Para un paciente ocasional atendido en una sola sesión. En un paso se registra lo mínimo de la historia clínica
          (NTS 139) y queda igual que en el flujo completo: historia, examen, diagnóstico, plan y evolución firmada.
          Los procedimientos que requieren consentimiento informado se registran con el flujo completo.
        </p>
        <FormularioAtencionRapida pacienteId={id} previo={previo.data ?? null} preguntarEmbarazo={puedeGestar(paciente)}
          procedimientos={lista.filter((p) => !p.requiere_consentimiento)}
          conConsentimiento={lista.filter((p) => p.requiere_consentimiento).map((p) => p.nombre)} />
      </main>
    </>
  );
}
