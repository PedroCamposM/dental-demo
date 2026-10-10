import type { Metadata } from "next";
import { destinoSeguro } from "@/lib/auth/rutas";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar – Dental Demo" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string }>;
}) {
  const { next, motivo } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Dental Demo</h1>
        <p className="mb-6 mt-1 text-sm text-gray-600">
          Historia clínica, tratamientos y seguimiento de tus pacientes.
        </p>
        {motivo === "inactividad" && (
          <p role="status" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Cerramos tu sesión por inactividad. Vuelve a ingresar.
          </p>
        )}
        <FormularioLogin next={destinoSeguro(next)} />
      </div>
    </main>
  );
}
