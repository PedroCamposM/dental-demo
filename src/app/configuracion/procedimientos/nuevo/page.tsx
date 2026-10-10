import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/encabezado";
import { sesionAdminCatalogo } from "../datos";
import { FormularioProcedimiento } from "../formulario";

export const metadata: Metadata = { title: "Nuevo procedimiento – Dental Demo" };

export default async function NuevoProcedimiento() {
  const sesion = await sesionAdminCatalogo();
  return (
    <>
      <Encabezado sesion={sesion} seccion="configuracion" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/configuracion/procedimientos" className="text-sm font-medium text-teal-700 hover:underline">
          ← Procedimientos y aranceles
        </Link>
        <h1 className="mb-6 mt-3 text-2xl font-semibold">Nuevo procedimiento</h1>
        <FormularioProcedimiento inicial={{ duracion_minutos: "30" }} />
      </main>
    </>
  );
}
