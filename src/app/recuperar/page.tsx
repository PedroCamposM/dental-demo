import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { modulos } from "@/lib/funciones";
import { FormularioRecuperar } from "./formulario";

export const metadata: Metadata = { title: "Recuperar acceso – Dental Demo" };

export default function Recuperar() {
  if (!modulos.etapa19) notFound();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">¿Olvidaste tu contraseña?</h1>
        <p className="mb-6 mt-1 text-sm text-gray-600">Escribe tu correo y te enviaremos un enlace para crear una nueva.</p>
        <FormularioRecuperar />
        <p className="mt-6 text-center text-sm"><Link href="/login" className="font-medium text-teal-700 hover:underline">Volver a ingresar</Link></p>
      </div>
    </main>
  );
}
