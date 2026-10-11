import type { Metadata } from "next";
import { tipoEnlace } from "@/lib/auth/enlace";
import { continuar } from "./acciones";

export const metadata: Metadata = { title: "Continuar – Dental Demo" };

const TITULO: Record<string, string> = {
  invite: "Bienvenida a tu clínica", recovery: "Crea tu nueva contraseña", signup: "Confirma tu correo", email: "Confirma tu correo",
};

/** Paso intermedio de los enlaces de correo: el token se usa solo al pulsar el botón. */
export default async function Continuar({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: tokenHash = "", type } = await searchParams;
  const tipo = tipoEnlace(type ?? null);
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">{tipo ? TITULO[tipo] : "Enlace no válido"}</h1>
        {tipo && tokenHash ? (
          <form action={continuar} className="mt-6">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={tipo} />
            <button type="submit" className="w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
              Continuar
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-gray-600">Pide un enlace nuevo o ingresa con tu correo y contraseña.</p>
        )}
      </div>
    </main>
  );
}
