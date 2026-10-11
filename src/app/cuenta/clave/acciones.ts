"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_CLAVE_LIBRE } from "@/lib/auth/enlace";
import { errorClave } from "@/lib/equipo";
import { registrarError } from "@/lib/registro";
import { COOKIE_BLOQUEO } from "@/lib/sesion-segura/inactividad";
import { createClient } from "@/lib/supabase/server";

export type EstadoClave = { error: string | null };

/**
 * Crea o cambia la contraseña de quien tiene sesión. Con la pantalla bloqueada no se puede; sin un
 * enlace reciente del correo (invitación o recuperación) exige la contraseña actual: así nadie
 * cambia la clave de otro en una tablet o PC desatendida.
 */
export async function guardarClave(_previo: EstadoClave, form: FormData): Promise<EstadoClave> {
  const almacen = await cookies();
  if (almacen.get(COOKIE_BLOQUEO)?.value === "1") return { error: "La pantalla está bloqueada: desbloquéala primero." };
  const clave = String(form.get("clave") ?? "");
  const repetir = String(form.get("repetir") ?? "");
  const e = errorClave(clave);
  if (e) return { error: e };
  if (clave !== repetir) return { error: "Las contraseñas no coinciden." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Tu sesión terminó. Vuelve a ingresar." };
  if (almacen.get(COOKIE_CLAVE_LIBRE)?.value !== "1") {
    const actual = String(form.get("actual") ?? "");
    const { error: errorActual } = await supabase.auth.signInWithPassword({ email: user.email, password: actual });
    if (errorActual) return { error: "La contraseña actual no es correcta." };
  }
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) {
    if (error.code === "same_password") return { error: "Usa una contraseña distinta de la anterior." };
    if (error.code === "weak_password") return { error: "La contraseña es muy débil: usa letras y números." };
    registrarError("cuenta.clave", error);
    return { error: "No se pudo guardar la contraseña. Vuelve a intentarlo." };
  }
  almacen.delete({ name: COOKIE_CLAVE_LIBRE, path: "/cuenta" });
  redirect("/");
}
