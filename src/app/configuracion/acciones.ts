"use server";

import { revalidatePath } from "next/cache";
import { modulos } from "@/lib/funciones";
import { esImagenPermitida, MAX_LOGO_BYTES, TIPOS_LOGO, validarColor, validarMembrete } from "@/lib/marca";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { minutosValidos } from "@/lib/sesion-segura/inactividad";
import { createClient } from "@/lib/supabase/server";

export type EstadoConfiguracion = { mensaje: string | null; error: string | null };

export async function guardarInactividad(_previo: EstadoConfiguracion, form: FormData): Promise<EstadoConfiguracion> {
  if (!modulos.etapa1) return { mensaje: null, error: "Este módulo aún no está habilitado." };
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") return { mensaje: null, error: "Solo el administrador cambia la configuración." };
  const minutos = minutosValidos(form.get("inactividad_minutos"));
  if (minutos === null) return { mensaje: null, error: "Elige entre 5 y 120 minutos." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("clinica").update({ inactividad_minutos: minutos })
    .eq("id", sesion.clinicaId).select("id").maybeSingle();
  if (error || !data) {
    registrarError("configuracion.inactividad", error ?? "sin fila");
    return { mensaje: null, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
  revalidatePath("/", "layout");
  return { mensaje: `Guardado: la sesión se cerrará tras ${minutos} minutos sin actividad.`, error: null };
}

// ---------------------------------------------------------------------------
// Etapa 15: marca de la clínica (color, logo y membrete de los documentos)
// ---------------------------------------------------------------------------
export type EstadoMarca = {
  mensaje: string | null; errores: Partial<Record<string, string>>; intento: number;
  /** Lo enviado, para no perderlo si hay que corregir algo. */
  valores: Record<string, string> | null;
};

export async function guardarMarca(previo: EstadoMarca, form: FormData): Promise<EstadoMarca> {
  const intento = previo.intento + 1;
  const texto = (c: string) => String(form.get(c) ?? "");
  const valores = Object.fromEntries(["color_marca", "direccion", "telefono", "correo", "pie_documentos"].map((c) => [c, texto(c)]));
  const fallo = (errores: EstadoMarca["errores"]): EstadoMarca => ({ mensaje: null, errores, intento, valores });
  if (!modulos.etapa15) return fallo({ general: "Este módulo aún no está habilitado." });
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "admin") return fallo({ general: "Solo el administrador cambia la configuración." });

  const color = validarColor(texto("color_marca"));
  const membrete = validarMembrete(texto);
  const errores: EstadoMarca["errores"] = {};
  if (!color.ok) errores.color_marca = color.error;
  if (!membrete.ok) Object.assign(errores, membrete.errores);

  const archivo = form.get("logo");
  const nuevoLogo = archivo instanceof File && archivo.size > 0 ? archivo : null;
  const extension = nuevoLogo ? TIPOS_LOGO[nuevoLogo.type as keyof typeof TIPOS_LOGO] : undefined;
  if (nuevoLogo && !extension) errores.logo = "El logo debe ser PNG, JPG o WebP.";
  else if (nuevoLogo && nuevoLogo.size > MAX_LOGO_BYTES) errores.logo = "El logo pesa más de 512 KB: redúcelo.";
  else if (nuevoLogo && !esImagenPermitida(new Uint8Array(await nuevoLogo.slice(0, 16).arrayBuffer()))) {
    errores.logo = "El archivo no es una imagen PNG, JPG o WebP válida.";
  }
  if (Object.keys(errores).length > 0 || !color.ok || !membrete.ok) return fallo(errores);

  const supabase = await createClient();
  const { data: actual, error: errorActual } = await supabase.from("clinica").select("logo_ruta").eq("id", sesion.clinicaId)
    .maybeSingle<{ logo_ruta: string | null }>();
  if (errorActual || !actual) {
    registrarError("configuracion.marca", errorActual ?? "sin fila");
    return fallo({ general: "No se pudo leer la configuración actual. Inténtalo de nuevo." });
  }
  const quitar = form.get("quitar_logo") === "1";
  let logoRuta = quitar ? null : actual.logo_ruta;
  if (nuevoLogo && extension) {
    // Nombre nuevo en cada cambio: así ningún navegador muestra el logo anterior guardado en caché.
    logoRuta = `${sesion.clinicaId}/logo-${Date.now()}.${extension}`;
    const { error: errorSubida } = await supabase.storage.from("marca")
      .upload(logoRuta, nuevoLogo, { contentType: nuevoLogo.type, upsert: false });
    if (errorSubida) {
      registrarError("configuracion.logo", errorSubida);
      return fallo({ logo: "No se pudo subir el logo. Inténtalo de nuevo." });
    }
  }
  const cambiaLogo = logoRuta !== actual.logo_ruta;
  // El logo solo se escribe si cambia, y solo si nadie lo cambió mientras tanto (dos pestañas o
  // dos administradores a la vez): así la clínica nunca queda apuntando a un archivo borrado.
  let consulta = supabase.from("clinica")
    .update({ color_marca: color.color, ...membrete.datos, ...(cambiaLogo ? { logo_ruta: logoRuta } : {}) })
    .eq("id", sesion.clinicaId);
  if (cambiaLogo) consulta = actual.logo_ruta === null ? consulta.is("logo_ruta", null) : consulta.eq("logo_ruta", actual.logo_ruta);
  const { data, error } = await consulta.select("id").maybeSingle();
  if (error || !data) {
    if (nuevoLogo && logoRuta) await supabase.storage.from("marca").remove([logoRuta]);
    if (error) registrarError("configuracion.marca", error);
    return fallo({ general: error ? "No se pudo guardar. Inténtalo de nuevo." : "El logo cambió mientras tanto (otra pestaña u otro administrador). Recarga la página y vuelve a intentarlo." });
  }
  // El logo anterior ya no se usa: se quita del bucket (si falla, solo queda un archivo sin uso).
  if (cambiaLogo && actual.logo_ruta) {
    const { error: errorBorrar } = await supabase.storage.from("marca").remove([actual.logo_ruta]);
    if (errorBorrar) registrarError("configuracion.logo_anterior", errorBorrar);
  }
  revalidatePath("/", "layout");
  return { mensaje: "Guardado: la app y los documentos ya usan la marca de la clínica.", errores: {}, intento, valores: null };
}
