"use server";

import { revalidatePath } from "next/cache";
import { fechaLima } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { registrarError } from "@/lib/registro";
import { obtenerSesion } from "@/lib/sesion";
import { MAX_CONSTANCIA_BYTES, tipoConstancia, validarReporte, type CampoReporte } from "@/lib/suscripcion";
import { createClient } from "@/lib/supabase/server";

export type EstadoReporte = {
  errores: Partial<Record<CampoReporte | "constancia" | "general", string>>;
  valores: Record<string, string>;
  mensaje: string | null;
  exitos: number;
};

// Mensajes de la base que se muestran tal cual (validaciones en español).
const MENSAJES_BASE = /^(Ya tienes un pago por confirmar|Ese número de operación|La fecha del pago|Elige|Escribe el número|La clínica de demostración)/;

/** El administrador reporta su pago (también con la clínica vencida). La base pone el monto. */
export async function reportarPago(previo: EstadoReporte, form: FormData): Promise<EstadoReporte> {
  const t = (c: string) => String(form.get(c) ?? "");
  const valores = { tarifa: t("tarifa"), periodo: t("periodo"), metodo: t("metodo"), operacion: t("operacion"), pagado_el: t("pagado_el") };
  const archivo = form.get("constancia");
  const constancia = archivo instanceof File && archivo.size > 0 ? archivo : null;
  // El formulario se reinicia tras cada envío: si traía constancia, hay que volver a adjuntarla.
  const fallo = (errores: EstadoReporte["errores"]): EstadoReporte => ({
    ...previo, valores, mensaje: null,
    errores: constancia && !errores.constancia ? { ...errores, constancia: "Vuelve a adjuntar la constancia." } : errores,
  });
  if (!modulos.etapa17) return fallo({ general: "Módulo apagado." });
  const sesion = await obtenerSesion();
  if (sesion?.rol !== "admin") return fallo({ general: "Solo el administrador reporta pagos." });

  const supabase = await createClient();
  const { data: tarifas } = await supabase.rpc("tarifas");
  const codigos = ((tarifas ?? []) as { codigo: string }[]).map((x) => x.codigo);
  const r = validarReporte(t, codigos, fechaLima(new Date()));
  const errores: EstadoReporte["errores"] = r.ok ? {} : { ...r.errores };
  let tipo: { ext: string; mime: string } | null = null;
  if (constancia) {
    tipo = tipoConstancia(new Uint8Array(await constancia.slice(0, 16).arrayBuffer()));
    if (constancia.size > MAX_CONSTANCIA_BYTES) errores.constancia = "La constancia pesa más de 1,5 MB.";
    else if (!tipo) errores.constancia = "La constancia debe ser una imagen (PNG, JPG o WebP) o un PDF.";
  }
  if (!r.ok || Object.keys(errores).length > 0) return fallo(errores);

  // Antes de subir la constancia: si ya hay un pago por confirmar, no se sube nada.
  const { count } = await supabase.from("pago_suscripcion").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
  if ((count ?? 0) > 0) return fallo({ general: "Ya tienes un pago por confirmar. Espera la confirmación antes de reportar otro." });

  let ruta: string | null = null;
  if (constancia && tipo) {
    ruta = `${sesion.clinicaId}/${crypto.randomUUID()}.${tipo.ext}`;
    const { error } = await supabase.storage.from("suscripcion").upload(ruta, constancia, { contentType: tipo.mime, upsert: false });
    if (error) {
      registrarError("plan.constancia", error);
      return fallo({ constancia: "No se pudo subir la constancia. Inténtalo de nuevo." });
    }
  }
  const { error } = await supabase.rpc("reportar_pago_suscripcion", {
    cod_tarifa: r.datos.tarifa, periodo_pago: r.datos.periodo, metodo_pago: r.datos.metodo,
    num_operacion: r.datos.operacion, fecha_pago: r.datos.pagado_el, ruta_constancia: ruta,
  });
  if (error) {
    // La constancia subida queda sin usar (no hay permiso de borrado): solo ocupa espacio.
    if (error.code === "P0001" && MENSAJES_BASE.test(error.message)) return fallo({ general: `${error.message}.` });
    registrarError("plan.reportar", error);
    return fallo({ general: "No se pudo reportar el pago. Inténtalo de nuevo." });
  }
  revalidatePath("/configuracion/plan");
  return { errores: {}, valores: {}, mensaje: "Pago reportado. Lo confirmaremos en cuanto lo veamos en la cuenta (normalmente en 1 día hábil).", exitos: previo.exitos + 1 };
}
