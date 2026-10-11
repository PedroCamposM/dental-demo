import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { COOKIE_CLAVE_LIBRE } from "@/lib/auth/enlace";
import { modulos } from "@/lib/funciones";
import { COOKIE_BLOQUEO } from "@/lib/sesion-segura/inactividad";
import { FormularioClave } from "./formulario";

export const metadata: Metadata = { title: "Tu contraseña – Dental Demo" };

/** Crear la contraseña (al aceptar una invitación o al recuperar el acceso) o cambiarla. */
export default async function Clave() {
  if (!modulos.etapa19) notFound();
  const almacen = await cookies();
  // Con la pantalla bloqueada no se cambia la contraseña (se vuelve a la app, que pide desbloquear).
  if (almacen.get(COOKIE_BLOQUEO)?.value === "1") redirect("/");
  const pedirActual = almacen.get(COOKIE_CLAVE_LIBRE)?.value !== "1";
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Tu contraseña</h1>
        <p className="mb-6 mt-1 text-sm text-gray-600">
          {pedirActual ? "Para cambiarla, escribe primero la actual." : "Crea la contraseña con la que entrarás a Dental Demo."}
        </p>
        <FormularioClave pedirActual={pedirActual} />
      </div>
    </main>
  );
}
