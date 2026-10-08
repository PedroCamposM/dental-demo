import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_PROCEDIMIENTO, sesionAdminCatalogo, type Procedimiento } from "../datos";
import { FormularioProcedimiento } from "../formulario";

export const metadata: Metadata = { title: "Editar procedimiento – Dental Demo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarProcedimiento({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionAdminCatalogo();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from("procedimiento").select(COLUMNAS_PROCEDIMIENTO)
    .eq("id", id).maybeSingle<Procedimiento>();
  if (error) registrarError("catalogo.leer", error, { id });
  if (!data) notFound();

  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/configuracion/procedimientos" className="text-sm font-medium text-teal-700 hover:underline">
          ← Procedimientos y aranceles
        </Link>
        <h1 className="mb-6 mt-3 text-2xl font-semibold">{data.nombre}</h1>
        <FormularioProcedimiento
          id={data.id}
          inicial={{
            codigo: data.codigo, nombre: data.nombre, especialidad: data.especialidad,
            precio: (data.precio_base_centimos / 100).toFixed(2), duracion_minutos: String(data.duracion_minutos),
            requiere_consentimiento: data.requiere_consentimiento ? "1" : "", control_dias: data.control_dias?.toString() ?? "",
            activo: data.activo ? "1" : "0",
          }}
        />
      </main>
    </>
  );
}
