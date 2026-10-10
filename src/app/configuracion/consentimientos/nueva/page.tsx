import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { modulos } from "@/lib/funciones";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioPlantilla } from "../formulario";

export const metadata: Metadata = { title: "Nueva plantilla de consentimiento – Dental Demo" };

export default async function NuevaPlantilla() {
  if (!modulos.etapa7) notFound();
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") redirect("/");
  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/configuracion/consentimientos" className="text-sm font-medium text-teal-700 hover:underline">← Consentimientos</Link>
        <h1 className="mb-6 mt-3 text-2xl font-semibold">Nueva plantilla de consentimiento</h1>
        <FormularioPlantilla inicial={{ tipo: "procedimiento", activa: "1" }} />
      </main>
    </>
  );
}
