import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cerrarSesion } from "@/app/login/actions";
import { modulos } from "@/lib/funciones";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { FormularioBienvenida } from "./formulario";

export const metadata: Metadata = { title: "Bienvenida – Dental Demo" };

/** Después de confirmar el correo: crea la clínica de prueba (30 días) con los datos del registro. */
export default async function Bienvenida() {
  if (!modulos.etapa16) notFound();
  if (await obtenerSesion()) redirect("/");
  const { data: { user } } = await (await createClient()).auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const texto = (c: string) => (typeof meta[c] === "string" ? meta[c] : "");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Crea tu clínica</h1>
        <p className="mb-6 mt-1 text-sm text-gray-600">
          Revisa los datos. Tendrás 30 días de prueba como administrador, con el catálogo de procedimientos,
          plantillas de ejemplo (revísalas antes de usarlas) y 3 pacientes de ejemplo que puedes anular.
        </p>
        <FormularioBienvenida valores={{ clinica: texto("clinica"), nombre: texto("nombre"), cop: texto("cop") }} />
        <form action={cerrarSesion} className="mt-6 text-center">
          <button type="submit" className="text-sm text-gray-600 hover:underline">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
