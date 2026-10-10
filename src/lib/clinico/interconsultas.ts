// Interconsultas y derivaciones: validación en el servidor. La base vuelve a validar
// (destinatario dentista activo de la clínica, estados, quién responde o cancela).
import { FORMATOS, MAX_BYTES } from "./archivos";

export const TIPOS_INTERCONSULTA = { interna: "Interna (a otro profesional de la clínica)", externa: "Externa (médico u otro centro)" } as const;
export type TipoInterconsulta = keyof typeof TIPOS_INTERCONSULTA;
export const ESTADOS_INTERCONSULTA = { pendiente: "Pendiente", respondida: "Respondida", cancelada: "Cancelada" } as const;
export type EstadoInterconsulta = keyof typeof ESTADOS_INTERCONSULTA;

export type CampoInterconsulta = "tipo" | "destinatario_id" | "destino" | "motivo" | "datos_clinicos" | "nota_id";
export type InterconsultaValidada = {
  tipo: TipoInterconsulta; destinatario_id: string | null; destino: string | null; motivo: string;
  datos_clinicos: string | null; nota_id: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarInterconsulta(t: (c: string) => string):
  { ok: true; datos: InterconsultaValidada } | { ok: false; errores: Partial<Record<CampoInterconsulta, string>> } {
  const e: Partial<Record<CampoInterconsulta, string>> = {};
  const tipo = t("tipo");
  if (!Object.hasOwn(TIPOS_INTERCONSULTA, tipo)) e.tipo = "Elige si es interna o externa.";
  const destinatario = t("destinatario_id");
  const destino = t("destino").trim().replace(/\s+/g, " ");
  if (tipo === "interna" && !UUID.test(destinatario)) e.destinatario_id = "Elige al profesional.";
  if (tipo === "externa" && (destino.length < 3 || destino.length > 200)) {
    e.destino = destino.length > 200 ? "Máximo 200 caracteres." : "Indica a quién o a qué centro se deriva.";
  }
  const motivo = t("motivo").trim();
  if (motivo.length < 10) e.motivo = "Describe el motivo (al menos 10 caracteres).";
  else if (motivo.length > 1000) e.motivo = "Máximo 1000 caracteres.";
  const datos = t("datos_clinicos").trim();
  if (datos.length > 2000) e.datos_clinicos = "Máximo 2000 caracteres.";
  const nota = t("nota_id");
  if (nota && !UUID.test(nota)) e.nota_id = "Sesión inválida.";
  if (Object.keys(e).length > 0) return { ok: false, errores: e };
  return {
    ok: true,
    datos: {
      tipo: tipo as TipoInterconsulta, destinatario_id: tipo === "interna" ? destinatario : null,
      destino: tipo === "externa" ? destino : null, motivo, datos_clinicos: datos || null, nota_id: nota || null,
    },
  };
}

/** Respuesta: texto obligatorio; documento opcional (ya subido a la ruta del paciente). */
export function validarRespuesta(t: (c: string) => string, contexto: { clinicaId: string; pacienteId: string }):
  { ok: true; datos: { texto: string; ruta: string | null; mime: string | null; bytes: number | null; nombre: string | null } }
  | { ok: false; error: string } {
  const texto = t("respuesta").trim();
  if (texto.length < 3) return { ok: false, error: "Escribe la respuesta o el resultado." };
  if (texto.length > 2000) return { ok: false, error: "Máximo 2000 caracteres." };
  const ruta = t("ruta");
  if (!ruta) return { ok: true, datos: { texto, ruta: null, mime: null, bytes: null, nombre: null } };
  const mime = t("mime");
  const bytes = /^\d{1,9}$/.test(t("bytes")) ? Number(t("bytes")) : NaN;
  const esperada = new RegExp(`^${contexto.clinicaId}/${contexto.pacienteId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`);
  if (!Object.hasOwn(FORMATOS, mime) || !(bytes > 0 && bytes <= MAX_BYTES) || !esperada.test(ruta)
      || !ruta.endsWith(`.${FORMATOS[mime as keyof typeof FORMATOS]}`)) {
    return { ok: false, error: "El documento no se subió bien. Vuelve a elegirlo." };
  }
  return { ok: true, datos: { texto, ruta, mime, bytes, nombre: t("nombre").trim().slice(0, 200) || "documento" } };
}
