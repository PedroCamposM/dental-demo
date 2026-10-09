import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { modulos } from "@/lib/funciones";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioPaciente } from "../formulario";

export const metadata: Metadata = { title: "Nuevo paciente – Dental Demo" };

export default async function NuevoPaciente() {
  if (!modulos.etapa1) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  return (
    <>
      <Encabezado sesion={sesion} seccion="pacientes" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/pacientes" className="text-sm font-medium text-teal-700 hover:underline">← Pacientes</Link>
        <h1 className="mb-6 mt-3 text-2xl font-semibold">Nuevo paciente</h1>
        <FormularioPaciente nts139={modulos.etapa3} />
      </main>
    </>
  );
}
