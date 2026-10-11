"use server";

import { redirect } from "next/navigation";
import { errorClave } from "@/lib/equipo";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";

export type EstadoClave = { error: string | null };

/** Crea o cambia la contraseña de quien tiene sesión (invitación, recuperación o cambio). */
export async function guardarClave(_previo: EstadoClave, form: FormData): Promise<EstadoClave> {
  const clave = String(form.get("clave") ?? "");
  const repetir = String(form.get("repetir") ?? "");
  const e = errorClave(clave);
  if (e) return { error: e };
  if (clave !== repetir) return { error: "Las contraseñas no coinciden." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) {
    if (error.code === "same_password") return { error: "Usa una contraseña distinta de la anterior." };
    if (error.code === "weak_password") return { error: "La contraseña es muy débil: usa letras y números." };
    registrarError("cuenta.clave", error);
    return { error: "No se pudo guardar la contraseña. Vuelve a intentarlo." };
  }
  redirect("/?clave=1");
}
