// Consentimientos: etiquetas y validación en el servidor. La base vuelve a validar
// (plantilla, ítem del paciente, representante del menor, escaneo subido, estados).
import { FORMATOS, MAX_BYTES } from "./archivos";

export const ESTADOS_CONSENTIMIENTO = {
  pendiente: "Pendiente de firma",
  firmado: "Firmado",
  negado: "El paciente se negó",
  revocado: "Revocado",
} as const;
export type EstadoConsentimiento = keyof typeof ESTADOS_CONSENTIMIENTO;

export const FINES_IMAGEN = { academico: "Fines académicos", difusion: "Difusión" } as const;
export type FinImagen = keyof typeof FINES_IMAGEN;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Generar el formato: de procedimiento (ítem del plan) o de uso de imagen (fines). */
export function validarGenerar(t: (c: string) => string, fines: string[]):
  { ok: true; datos: { tipo: "procedimiento"; item_plan_id: string; plantilla_id: string }
                   | { tipo: "uso_imagen"; fines: FinImagen[]; plantilla_id: string } }
  | { ok: false; error: string } {
  const tipo = t("tipo");
  const plantilla = t("plantilla_id");
  if (!UUID.test(plantilla)) return { ok: false, error: "Elige la plantilla del consentimiento." };
  if (tipo === "procedimiento") {
    const item = t("item_plan_id");
    if (!UUID.test(item)) return { ok: false, error: "Elige el procedimiento del plan." };
    return { ok: true, datos: { tipo, item_plan_id: item, plantilla_id: plantilla } };
  }
  if (tipo === "uso_imagen") {
    const elegidos = [...new Set(fines)].filter((f): f is FinImagen => Object.hasOwn(FINES_IMAGEN, f));
    if (elegidos.length === 0 || elegidos.length !== new Set(fines).size) {
      return { ok: false, error: "Marca para qué fines se autoriza el uso de imágenes." };
    }
    return { ok: true, datos: { tipo, fines: elegidos, plantilla_id: plantilla } };
  }
  return { ok: false, error: "Tipo de consentimiento inválido." };
}

/** Registrar la firma o la negativa con el escaneo ya subido a la ruta del paciente. */
export function validarRegistro(t: (c: string) => string, contexto: { clinicaId: string; pacienteId: string; hoy: string }):
  { ok: true; datos: { decision: "firmado" | "negado"; decidido: string; ruta: string; mime: string; bytes: number; nombre: string } }
  | { ok: false; error: string } {
  const decision = t("decision");
  if (decision !== "firmado" && decision !== "negado") return { ok: false, error: "Indica si el paciente firmó o se negó." };
  const fecha = t("decidido");
  if (!FECHA.test(fecha) || Number.isNaN(Date.parse(fecha))) return { ok: false, error: "Indica la fecha de la firma." };
  if (fecha > contexto.hoy) return { ok: false, error: "La fecha de la firma no puede ser futura." };
  const mime = t("mime");
  const bytes = /^\d{1,9}$/.test(t("bytes")) ? Number(t("bytes")) : NaN;
  const ruta = t("ruta");
  const esperada = new RegExp(`^${contexto.clinicaId}/${contexto.pacienteId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`);
  if (!Object.hasOwn(FORMATOS, mime) || !(bytes > 0 && bytes <= MAX_BYTES) || !esperada.test(ruta)
      || !ruta.endsWith(`.${FORMATOS[mime as keyof typeof FORMATOS]}`)) {
    return { ok: false, error: "El escaneo no se subió bien. Vuelve a elegirlo." };
  }
  return { ok: true, datos: { decision, decidido: fecha, ruta, mime, bytes, nombre: t("nombre").trim().slice(0, 200) || "formato" } };
}

/** Motivo de revocación o anulación. */
export function validarMotivo(motivo: string, max: number): string | null {
  const m = motivo.trim();
  if (m.length < 3) return "Escribe el motivo.";
  if (m.length > max) return `Máximo ${max} caracteres.`;
  return null;
}

// ---------------------------------------------------------------------------
// Plantillas (las mantiene el administrador)
// ---------------------------------------------------------------------------
export const TIPOS_PLANTILLA = { procedimiento: "Procedimiento", uso_imagen: "Uso de imagen" } as const;
export type TipoPlantilla = keyof typeof TIPOS_PLANTILLA;
export const CAMPOS_PLANTILLA = {
  nombre: { etiqueta: "Nombre", min: 3, max: 120 },
  descripcion: { etiqueta: "Descripción en términos sencillos", min: 10, max: 4000 },
  riesgos: { etiqueta: "Riesgos reales y potenciales", min: 10, max: 4000 },
  efectos_adversos: { etiqueta: "Efectos adversos de los medicamentos que se prevé usar", min: 0, max: 4000 },
  pronostico: { etiqueta: "Pronóstico y recomendaciones", min: 0, max: 2000 },
} as const;
export type CampoPlantilla = keyof typeof CAMPOS_PLANTILLA | "tipo";
export type PlantillaValidada = {
  tipo: TipoPlantilla; nombre: string; descripcion: string; riesgos: string;
  efectos_adversos: string | null; pronostico: string | null; es_ejemplo: boolean; activa: boolean;
};

export function validarPlantilla(t: (c: string) => string):
  { ok: true; datos: PlantillaValidada } | { ok: false; errores: Partial<Record<CampoPlantilla, string>> } {
  const errores: Partial<Record<CampoPlantilla, string>> = {};
  const tipo = t("tipo");
  if (!Object.hasOwn(TIPOS_PLANTILLA, tipo)) errores.tipo = "Elige el tipo.";
  const v: Record<string, string> = {};
  for (const [c, { min, max }] of Object.entries(CAMPOS_PLANTILLA)) {
    const valor = t(c).trim();
    v[c] = c === "nombre" ? valor.replace(/\s+/g, " ") : valor;
    if (min > 0 && valor.length < min) errores[c as CampoPlantilla] = c === "nombre" ? "Escribe el nombre." : "Completa este texto.";
    else if (valor.length > max) errores[c as CampoPlantilla] = `Máximo ${max} caracteres.`;
  }
  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      tipo: tipo as TipoPlantilla, nombre: v.nombre ?? "", descripcion: v.descripcion ?? "", riesgos: v.riesgos ?? "",
      efectos_adversos: v.efectos_adversos || null, pronostico: v.pronostico || null,
      es_ejemplo: t("revisada") !== "1" && t("es_ejemplo") === "1", activa: t("activa") !== "0",
    },
  };
}

export type ItemConOrigen = { id: string; item_origen_id: string | null; procedimiento_id: string | null; pieza: number | null };

/**
 * Ítems cubiertos por un consentimiento firmado: el propio o el del ítem del que se
 * copió en una versión anterior del plan (mismo procedimiento y pieza). Es lo mismo
 * que exige la base (privado.tiene_consentimiento) para marcarlo realizado.
 */
export function itemsConConsentimiento(items: ItemConOrigen[], conFirmado: Set<string>): Set<string> {
  const porId = new Map(items.map((i) => [i.id, i]));
  const cubiertos = new Set<string>();
  for (const item of items) {
    let actual: ItemConOrigen | undefined = item;
    const vistos = new Set<string>();
    while (actual && !vistos.has(actual.id)) {
      if (conFirmado.has(actual.id)) {
        cubiertos.add(item.id);
        break;
      }
      vistos.add(actual.id);
      const origen: ItemConOrigen | undefined = actual.item_origen_id ? porId.get(actual.item_origen_id) : undefined;
      actual = origen && origen.procedimiento_id === actual.procedimiento_id && origen.pieza === actual.pieza ? origen : undefined;
    }
  }
  return cubiertos;
}
