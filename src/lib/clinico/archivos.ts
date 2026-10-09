// Imágenes y archivos clínicos: tipos, límites y validación en el servidor.
// La base vuelve a validar (ruta de la clínica y del paciente, objeto subido, RLS).
import { esPiezaFdi } from "./diagnostico";

export const TIPOS_ARCHIVO = {
  radiografia: "Radiografía",
  foto_intraoral: "Foto intraoral",
  foto_extraoral: "Foto extraoral",
  documento: "Documento",
} as const;
export type TipoArchivo = keyof typeof TIPOS_ARCHIVO;
/** Tipos que suben otros flujos (consentimiento firmado, respuesta de interconsulta). */
export const TIPOS_OTROS = { consentimiento: "Consentimiento firmado", interconsulta: "Respuesta de interconsulta" } as const;

/** Formatos aceptados y su extensión en la ruta del bucket. */
export const FORMATOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;
export type Mime = keyof typeof FORMATOS;
export const MAX_BYTES = 10 * 1024 * 1024;

export const esImagen = (mime: string) => mime.startsWith("image/");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Ruta del objeto: <clínica>/<paciente>/<uuid>.<ext>. */
export function rutaArchivo(clinicaId: string, pacienteId: string, id: string, mime: Mime): string {
  return `${clinicaId}/${pacienteId}/${id}.${FORMATOS[mime]}`;
}

/** Antes de subir (en el navegador): formato y tamaño. */
export function revisarArchivo(f: { type: string; size: number }): string | null {
  if (!Object.hasOwn(FORMATOS, f.type)) return "Formato no admitido: usa JPG, PNG, WEBP o PDF.";
  if (f.size <= 0) return "El archivo está vacío.";
  if (f.size > MAX_BYTES) return "El archivo pesa más de 10 MB.";
  return null;
}

export type CampoArchivo = "tipo" | "tomada_el" | "pieza" | "nota_id" | "descripcion" | "archivo";
export type ArchivoValidado = {
  tipo: TipoArchivo; ruta: string; nombre: string | null; mime: Mime; bytes: number; tomada_el: string;
  pieza: number | null; nota_id: string | null; descripcion: string | null;
};

export function validarArchivo(
  t: (campo: string) => string, contexto: { clinicaId: string; pacienteId: string; hoy: string },
): { ok: true; datos: ArchivoValidado } | { ok: false; errores: Partial<Record<CampoArchivo, string>> } {
  const errores: Partial<Record<CampoArchivo, string>> = {};
  const tipo = t("tipo");
  if (!Object.hasOwn(TIPOS_ARCHIVO, tipo)) errores.tipo = "Elige el tipo.";
  const mime = t("mime");
  const bytes = /^\d{1,9}$/.test(t("bytes")) ? Number(t("bytes")) : NaN;
  const ruta = t("ruta");
  const esperada = new RegExp(`^${contexto.clinicaId}/${contexto.pacienteId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`);
  if (!Object.hasOwn(FORMATOS, mime) || !(bytes > 0 && bytes <= MAX_BYTES) || !esperada.test(ruta)
      || !ruta.endsWith(`.${FORMATOS[mime as Mime]}`)) {
    errores.archivo = "El archivo no se subió bien. Vuelve a elegirlo.";
  }
  const fecha = t("tomada_el");
  if (!FECHA.test(fecha) || Number.isNaN(Date.parse(fecha))) errores.tomada_el = "Indica la fecha de la imagen.";
  else if (fecha > contexto.hoy) errores.tomada_el = "La fecha no puede ser futura.";
  else if (fecha < "1950-01-01") errores.tomada_el = "Fecha inválida.";
  const piezaTexto = t("pieza");
  const pieza = piezaTexto === "" ? null : Number(piezaTexto);
  if (pieza !== null && !(/^\d{2}$/.test(piezaTexto) && esPiezaFdi(pieza))) errores.pieza = "Pieza FDI inválida (p. ej. 36 o 75).";
  const nota = t("nota_id");
  if (nota && !UUID.test(nota)) errores.nota_id = "Sesión inválida.";
  const descripcion = t("descripcion").trim().replace(/\s+/g, " ");
  if (descripcion.length > 500) errores.descripcion = "Máximo 500 caracteres.";
  if (Object.keys(errores).length > 0) return { ok: false, errores };
  const nombre = t("nombre").trim().slice(0, 200);
  return {
    ok: true,
    datos: {
      tipo: tipo as TipoArchivo, ruta, nombre: nombre || null, mime: mime as Mime, bytes, tomada_el: fecha, pieza,
      nota_id: nota || null, descripcion: descripcion || null,
    },
  };
}
