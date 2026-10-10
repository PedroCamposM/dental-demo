import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { TIPOS_PLANTILLA, type TipoPlantilla } from "@/lib/clinico/consentimientos";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { FormularioPlantilla } from "../formulario";

export const metadata: Metadata = { title: "Editar plantilla de consentimiento – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Plantilla = {
  id: string; tipo: TipoPlantilla; nombre: string; descripcion: string; riesgos: string; efectos_adversos: string | null;
  pronostico: string | null; es_ejemplo: boolean; activa: boolean;
};

export default async function EditarPlantilla({ params }: { params: Promise<{ id: string }> }) {
  if (!modulos.etapa7) notFound();
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") redirect("/");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("plantilla_consentimiento")
    .select("id, tipo, nombre, descripcion, riesgos, efectos_adversos, pronostico, es_ejemplo, activa").eq("id", id)
    .maybeSingle<Plantilla>();
  if (error) registrarError("plantilla.leer", error, { id });
  if (!data) notFound();
  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/configuracion/consentimientos" className="text-sm font-medium text-teal-700 hover:underline">← Consentimientos</Link>
        <h1 className="mt-3 text-2xl font-semibold">{data.nombre}</h1>
        <p className="mb-6 text-sm text-gray-600">Tipo: {TIPOS_PLANTILLA[data.tipo]}</p>
        <FormularioPlantilla id={data.id} inicial={{
          tipo: data.tipo, nombre: data.nombre, descripcion: data.descripcion, riesgos: data.riesgos,
          efectos_adversos: data.efectos_adversos ?? "", pronostico: data.pronostico ?? "",
          es_ejemplo: data.es_ejemplo ? "1" : "0", activa: data.activa ? "1" : "0",
        }} />
      </main>
    </>
  );
}
