import type { Metadata } from "next";
import { destinoSeguro } from "@/lib/auth/rutas";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar – Dental Demo" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Dental Demo</h1>
        <p className="mb-6 mt-1 text-sm text-gray-600">
          Mira cuánta plata tienes en riesgo y a quién llamar hoy.
        </p>
        <FormularioLogin next={destinoSeguro(next)} />
      </div>
    </main>
  );
}
