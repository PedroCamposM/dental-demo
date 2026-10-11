"use server";

import { revalidatePath } from "next/cache";
import { modulos } from "@/lib/funciones";
import { esFecha } from "@/lib/plataforma";
import { registrarError } from "@/lib/registro";
import { createClient } from "@/lib/supabase/server";
import type { EstadoSimple } from "./acciones";

const UUID = /^[0-9a-f-]{36}$/;
// Mensajes de la base que se muestran tal cual (validaciones); lo demás se registra y se resume.
const MENSAJES = new RegExp("^(Solo el superadministrador|Escribe el motivo|Clínica no encontrada|La clínica de demostración|"
  + "La clínica ya está suspendida|La clínica no está suspendida|El nombre de la clínica|El descuento va|La fecha de fin del descuento|"
  + "El aviso|Elige el tipo de aviso|Aviso no encontrado|El nombre de la clínica de demostración)");

async function llamar(rpc: string, args: Record<string, unknown>, contexto: string, previo: EstadoSimple, mensaje: string,
                      rutas: string[]): Promise<EstadoSimple> {
  const { error } = await (await createClient()).rpc(rpc, args);
  if (error) {
    if (error.code === "P0001" && MENSAJES.test(error.message)) return { ...previo, error: `${error.message}.`, mensaje: null };
    registrarError(contexto, error);
    return { ...previo, error: "No se pudo guardar. Vuelve a intentarlo.", mensaje: null };
  }
  for (const r of rutas) revalidatePath(r);
  return { error: null, mensaje, exitos: previo.exitos + 1 };
}

const apagado = (previo: EstadoSimple): EstadoSimple => ({ ...previo, error: "Módulo apagado.", mensaje: null });
const falla = (previo: EstadoSimple, error: string): EstadoSimple => ({ ...previo, error, mensaje: null });

/** El superadministrador corrige el nombre de una clínica (con motivo; queda en la auditoría y la bitácora). */
export async function renombrarClinica(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  if (!modulos.etapa20) return apagado(previo);
  const id = String(form.get("clinica_id") ?? "");
  const nombre = String(form.get("nombre") ?? "").trim();
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!UUID.test(id)) return falla(previo, "Clínica inválida.");
  if (nombre.length < 3 || nombre.length > 120) return falla(previo, "El nombre de la clínica va de 3 a 120 caracteres.");
  if (motivo.length < 3 || motivo.length > 300) return falla(previo, "Escribe el motivo (de 3 a 300 caracteres).");
  return llamar("cambiar_nombre_clinica", { id_clinica: id, nuevo_nombre: nombre, motivo }, "plataforma.nombre", previo,
    "Nombre guardado.", ["/plataforma", `/plataforma/clinicas/${id}`]);
}

/** Suspende (solo lectura) o reactiva una clínica, con motivo. */
export async function suspenderClinica(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  if (!modulos.etapa20) return apagado(previo);
  const id = String(form.get("clinica_id") ?? "");
  const suspender = form.get("accion") === "suspender";
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!UUID.test(id)) return falla(previo, "Clínica inválida.");
  if (motivo.length < 3 || motivo.length > 500) return falla(previo, "Escribe el motivo (de 3 a 500 caracteres).");
  return llamar("suspender_clinica", { id_clinica: id, suspender, motivo }, "plataforma.suspender", previo,
    suspender ? "Clínica suspendida: queda en solo lectura." : "Clínica reactivada.", ["/plataforma", `/plataforma/clinicas/${id}`]);
}

/** Descuento por clínica (0 lo quita). Se aplica cuando la clínica reporta su próximo pago. */
export async function guardarDescuento(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  if (!modulos.etapa20) return apagado(previo);
  const id = String(form.get("clinica_id") ?? "");
  const pctTexto = String(form.get("porcentaje") ?? "").trim();
  const hasta = String(form.get("hasta") ?? "").trim();
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!UUID.test(id)) return falla(previo, "Clínica inválida.");
  if (!/^\d{1,2}$/.test(pctTexto) || Number(pctTexto) > 90) return falla(previo, "El descuento va de 0 % (sin descuento) a 90 %.");
  if (hasta && !esFecha(hasta)) return falla(previo, "Elige una fecha de fin válida o déjala vacía.");
  if (motivo.length < 3 || motivo.length > 300) return falla(previo, "Escribe el motivo (de 3 a 300 caracteres).");
  const porcentaje = Number(pctTexto);
  return llamar("guardar_descuento", { id_clinica: id, porcentaje, hasta: hasta || null, motivo }, "plataforma.descuento", previo,
    porcentaje === 0 ? "Descuento quitado." : `Descuento del ${porcentaje} % guardado.`, ["/plataforma", `/plataforma/clinicas/${id}`]);
}

/** Aviso dentro del sistema, para todas las clínicas o para una. */
export async function publicarAviso(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  if (!modulos.etapa20) return apagado(previo);
  const clinica = String(form.get("clinica_id") ?? "");
  const texto = String(form.get("texto") ?? "").trim();
  const nivel = String(form.get("nivel") ?? "");
  const hasta = String(form.get("hasta") ?? "");
  if (clinica && !UUID.test(clinica)) return falla(previo, "Clínica inválida.");
  if (texto.length < 3 || texto.length > 500) return falla(previo, "El aviso va de 3 a 500 caracteres.");
  if (nivel !== "info" && nivel !== "importante") return falla(previo, "Elige el tipo de aviso.");
  if (!esFecha(hasta)) return falla(previo, "Elige hasta cuándo se muestra.");
  return llamar("publicar_aviso", { id_clinica: clinica || null, texto, nivel, hasta }, "plataforma.aviso", previo,
    "Aviso publicado.", ["/plataforma", ...(clinica ? [`/plataforma/clinicas/${clinica}`] : [])]);
}

export async function retirarAviso(previo: EstadoSimple, form: FormData): Promise<EstadoSimple> {
  if (!modulos.etapa20) return apagado(previo);
  const id = String(form.get("aviso_id") ?? "");
  if (!UUID.test(id)) return falla(previo, "Aviso inválido.");
  return llamar("retirar_aviso", { id_aviso: id }, "plataforma.retirar_aviso", previo, "Aviso retirado.", ["/plataforma"]);
}
