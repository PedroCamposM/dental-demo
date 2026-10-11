import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { modulos } from "@/lib/funciones";
import { FormularioClave } from "./formulario";

export const metadata: Metadata = { title: "Tu contraseña – Dental Demo" };

/** Crear la contraseña (al aceptar una invitación o al recuperar el acceso) o cambiarla. */
export default function Clave() {
  if (!modulos.etapa19) notFound();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Tu contraseña</h1>
        <p className="mb-6 mt-1 text-sm text-gray-600">Crea la contraseña con la que entrarás a Dental Demo.</p>
        <FormularioClave />
      </div>
    </main>
  );
}
