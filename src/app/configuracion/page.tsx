import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { modulos } from "@/lib/funciones";
import { urlLogo } from "@/lib/marca-servidor";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { FormularioInactividad, FormularioMarca } from "./formulario";
import { NavegacionConfiguracion } from "./navegacion";

export const metadata: Metadata = { title: "Configuración – Dental Demo" };

export default async function Configuracion() {
  if (!modulos.etapa1) notFound();
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/");
  if (sesion.rol !== "admin") redirect("/");
  type Marca = { color_marca: string | null; direccion: string | null; telefono: string | null; correo: string | null;
    pie_documentos: string | null; logo_ruta: string | null };
  const marca = modulos.etapa15
    ? await (await createClient()).from("clinica").select("color_marca, direccion, telefono, correo, pie_documentos, logo_ruta")
        .eq("id", sesion.clinicaId).maybeSingle<Marca>()
    : null;
  if (marca?.error) registrarError("configuracion.marca", marca.error);
  const logo = await urlLogo(marca?.data?.logo_ruta ?? null);
  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Configuración de la clínica</h1>
        <NavegacionConfiguracion actual="general" />
        <section className="mt-6 max-w-3xl rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Seguridad de sesión</h2>
          <FormularioInactividad minutos={sesion.inactividadMinutos ?? 15} />
        </section>
        {modulos.etapa15 && (
          <section aria-labelledby="t-marca" className="mt-6 max-w-3xl rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-marca" className="mb-1 text-lg font-semibold">Marca de la clínica</h2>
            <p className="mb-4 text-sm text-gray-600">El color se usa en toda la app; el logo y el membrete, también en los documentos impresos.</p>
            <FormularioMarca logo={logo} valores={{
              color_marca: marca?.data?.color_marca ?? null, direccion: marca?.data?.direccion ?? null,
              telefono: marca?.data?.telefono ?? null, correo: marca?.data?.correo ?? null,
              pie_documentos: marca?.data?.pie_documentos ?? null,
            }} />
          </section>
        )}
      </main>
    </>
  );
}
