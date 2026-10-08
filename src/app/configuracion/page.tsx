import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { modulos } from "@/lib/funciones";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioInactividad } from "./formulario";

export const metadata: Metadata = { title: "Configuración – Dental Demo" };

export default async function Configuracion() {
  if (!modulos.etapa1) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (sesion.rol !== "admin") redirect("/");
  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Configuración de la clínica</h1>
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Seguridad de sesión</h2>
          <FormularioInactividad minutos={sesion.inactividadMinutos ?? 15} />
        </section>
      </main>
    </>
  );
}
