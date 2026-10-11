import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cerrarSesion } from "@/app/login/actions";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { estadoPlan, type PlanClinica } from "@/lib/prueba";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import { FormularioPlan } from "./formulario";

export const metadata: Metadata = { title: "Plataforma – Dental Demo" };

type Fila = {
  id: string; nombre: string; plan: PlanClinica; prueba_hasta: string | null; activo_hasta: string | null; creada: string;
  usuarios: number; pacientes: number; administrador: string | null;
};

const NOMBRE_PLAN: Record<PlanClinica, string> = { demo: "Demostración", prueba: "Prueba", activo: "Activo" };

/** Panel del superadministrador: clínicas registradas y activación manual del plan. */
export default async function Plataforma() {
  if (!modulos.etapa16) notFound();
  const supabase = await createClient();
  const { data: esSuper } = await supabase.rpc("es_superadmin");
  if (esSuper !== true) notFound();
  const { data, error } = await supabase.rpc("clinicas_plataforma");
  const filas = (data ?? []) as Fila[];
  if (error) registrarError("plataforma.clinicas", error);
  const hoy = fechaLima(new Date());
  const enUnMes = fechaLima(new Date(Date.now() + 31 * 86_400_000));
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clínicas de la plataforma</h1>
        <form action={cerrarSesion}>
          <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Cerrar sesión</button>
        </form>
      </div>
      <p className="mt-1 text-sm text-gray-600">Activa el plan al confirmar el pago. Cada cambio queda en la auditoría de la clínica con su motivo.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">No se pudo cargar la lista de clínicas.</p>}
      <ul className="mt-6 flex flex-col gap-3">
        {filas.map((c) => {
          const est = estadoPlan(c, hoy);
          const hasta = c.plan === "prueba" ? c.prueba_hasta : c.plan === "activo" ? c.activo_hasta : null;
          return (
            <li key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{c.nombre}</h2>
                <p className={`text-sm ${est.soloLectura ? "font-medium text-red-700" : "text-gray-600"}`}>
                  {NOMBRE_PLAN[c.plan]}{hasta ? ` hasta ${hasta}` : ""}{est.soloLectura ? " · solo lectura" : ""}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Desde {c.creada} · {c.usuarios} usuario(s) · {c.pacientes} paciente(s) · Administrador: {c.administrador ?? "—"}
              </p>
              {c.plan !== "demo" && (
                <div className="mt-3"><FormularioPlan clinicaId={c.id} nombre={c.nombre} hastaSugerido={enUnMes} /></div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
