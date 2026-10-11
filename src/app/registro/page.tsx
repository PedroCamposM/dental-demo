import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { modulos } from "@/lib/funciones";
import { FormularioRegistro } from "./formulario";

export const metadata: Metadata = { title: "Prueba gratis – Dental Demo" };

export default function PaginaRegistro() {
  if (!modulos.etapa16) notFound();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Prueba gratis 30 días</h1>
        <p className="mb-6 mt-1 text-sm text-gray-600">
          Crea la cuenta de tu clínica. Empiezas con pacientes de ejemplo para conocer el sistema; sin tarjeta.
          Al terminar la prueba, tus datos no se borran: quedan en solo lectura hasta que actives el plan.
        </p>
        <FormularioRegistro />
        <p className="mt-6 text-center text-sm text-gray-600">
          ¿Ya tienes cuenta? <Link href="/login" className="font-medium text-teal-700 hover:underline">Ingresar</Link>
        </p>
      </div>
    </main>
  );
}
