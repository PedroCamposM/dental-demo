import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/encabezado";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_PROCEDIMIENTO, sesionAdminCatalogo, type Procedimiento } from "../datos";
import { AsignarPlantilla } from "../../consentimientos/formulario";
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
  // Etapa 7: qué consentimiento usa (columna de la migración 0914).
  const [consentimiento, plantillas] = modulos.etapa7
    ? await Promise.all([
        supabase.from("procedimiento").select("consentimiento_plantilla_id").eq("id", id)
          .maybeSingle<{ consentimiento_plantilla_id: string | null }>(),
        supabase.from("plantilla_consentimiento").select("id, nombre").eq("tipo", "procedimiento").eq("activa", true)
          .order("nombre").returns<{ id: string; nombre: string }[]>(),
      ])
    : [null, null];

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
        {consentimiento && plantillas && (
          <section aria-labelledby="t-consentimiento" className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
            <h2 id="t-consentimiento" className="mb-3 text-lg font-semibold">Consentimiento informado</h2>
            <AsignarPlantilla procedimientoId={data.id} actual={consentimiento.data?.consentimiento_plantilla_id ?? null}
              plantillas={plantillas.data ?? []} />
          </section>
        )}
      </main>
    </>
  );
}
