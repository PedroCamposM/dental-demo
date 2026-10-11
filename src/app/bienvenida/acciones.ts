"use server";

import { redirect } from "next/navigation";
import { modulos } from "@/lib/funciones";
import { validarClinica } from "@/lib/prueba";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

export type EstadoBienvenida = { errores: Partial<Record<"clinica" | "nombre" | "cop" | "general", string>>; valores: Record<string, string> };

// Mensajes de la base que se pueden mostrar tal cual (validaciones en español).
const MENSAJES_BASE = /^(El nombre de la clínica|Tu nombre|El número de colegiatura|El superadministrador)/;

export async function crearMiClinica(_previo: EstadoBienvenida, form: FormData): Promise<EstadoBienvenida> {
  if (!modulos.etapa16) return { errores: { general: "El registro aún no está abierto." }, valores: {} };
  const t = (c: string) => String(form.get(c) ?? "");
  const valores = { clinica: t("clinica"), nombre: t("nombre"), cop: t("cop") };
  const r = validarClinica(t);
  if (!r.ok) return { errores: r.errores, valores };
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_clinica_prueba", {
    nombre_clinica: r.datos.clinica, nombre_usuario: r.datos.nombre, cop: r.datos.cop,
  });
  if (error) {
    // Doble envío: la clínica ya se creó con el primero.
    if (error.message.startsWith("Tu usuario ya pertenece") || error.code === "23505") redirect("/");
    if (error.code === "P0001" && MENSAJES_BASE.test(error.message)) return { errores: { general: `${error.message}.` }, valores };
    registrarError("bienvenida.crear_clinica_prueba", error);
    return { errores: { general: "No pudimos crear tu clínica. Vuelve a intentarlo en unos minutos." }, valores };
  }
  redirect("/");
}
