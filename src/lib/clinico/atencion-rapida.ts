// Atención rápida (Etapa 14): paciente ocasional, una sola sesión. Valida en el servidor lo
// mínimo que la NTS 139 pide en la primera atención de consulta externa (5.2.1 g y ficha
// 12.2) y arma los datos para public.registrar_atencion_rapida, que vuelve a validar.
import { esPiezaFdi, leerCodigoCie10 } from "@/lib/clinico/diagnostico";
import { leerListaPiezas, MAX_PIEZAS } from "@/lib/odontograma/hallazgo";

/** Filas de procedimientos en el formulario. */
export const FILAS_PROCEDIMIENTO = 4;

export type ProcedimientoRapido = { id: string; nombre: string; requiere_consentimiento: boolean };

export type CampoAtencion =
  | "motivo_consulta" | "tiempo_enfermedad" | "alergias" | "anticoagulado" | "anticoagulante" | "embarazo" | "medicacion"
  | "examen" | "higiene" | "cie10" | "tipo_dx" | "pieza_dx" | "procedimientos" | "descripcion" | "anestesia_tipo"
  | "anestesia_cantidad" | "indicaciones" | "proxima_cita";

export type DatosAtencion = {
  historia: {
    motivo_consulta: string; tiempo_enfermedad: string | null; alergias_preguntadas: true; alergias: string[];
    anticoagulado: boolean; anticoagulante: string | null; embarazo: string; medicacion: string | null;
  };
  examen: { observaciones: string; higiene: string | null };
  diagnostico: { cie10: string; tipo: "presuntivo" | "definitivo"; pieza: string | null };
  items: { procedimiento_id: string; pieza: string | null }[];
  evolucion: {
    texto: string; anestesia_tipo: string | null; anestesia_cantidad: string | null; indicaciones: string | null;
    proxima_cita: string | null;
  };
};

const EMBARAZO = ["no", "si", "no_sabe", "no_aplica"];
const HIGIENE = ["buena", "regular", "mala"];

export function validarAtencionRapida(
  t: (campo: string) => string,
  contexto: { codigosCie10: Set<string>; procedimientos: ProcedimientoRapido[] },
): { ok: true; datos: DatosAtencion } | { ok: false; errores: Partial<Record<CampoAtencion, string>> } {
  const e: Partial<Record<CampoAtencion, string>> = {};
  const texto = (c: string, max: number, campo: CampoAtencion, nombre: string) => {
    const v = t(c).trim();
    if (v.length > max) e[campo] = `${nombre}: máximo ${max} caracteres.`;
    return v || null;
  };

  // Anamnesis (lo propio de esta consulta) y antecedentes que no pueden faltar
  const motivo = texto("motivo_consulta", 500, "motivo_consulta", "Motivo de consulta");
  if (!motivo || motivo.length < 3) e.motivo_consulta = "Escribe el motivo de consulta.";
  const tiempo = texto("tiempo_enfermedad", 100, "tiempo_enfermedad", "Tiempo de enfermedad");
  const ninguna = t("alergias_ninguna") === "1";
  const alergias = [...new Set(t("alergias").split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean))];
  if (!ninguna && alergias.length === 0) e.alergias = "Pregunta por las alergias: escríbelas o marca «Ninguna conocida».";
  else if (ninguna && alergias.length > 0) e.alergias = "Marcaste «Ninguna conocida» y escribiste alergias: deja una de las dos.";
  else if (alergias.length > 15 || alergias.some((a) => a.length > 80)) e.alergias = "Hasta 15 alergias, de 80 caracteres cada una.";
  const anticoag = t("anticoagulado");
  if (anticoag !== "si" && anticoag !== "no") e.anticoagulado = "Indica si toma anticoagulantes.";
  const anticoagulante = texto("anticoagulante", 200, "anticoagulante", "Anticoagulante");
  if (anticoag === "si" && (!anticoagulante || anticoagulante.length < 2)) e.anticoagulante = "Indica cuál anticoagulante toma.";
  const embarazo = t("embarazo") || "no_aplica";
  if (!EMBARAZO.includes(embarazo)) e.embarazo = "Elige una opción.";
  const medicacion = texto("medicacion", 1000, "medicacion", "Medicación");

  // Examen
  const examen = texto("examen", 2000, "examen", "Examen");
  if (!examen || examen.length < 3) e.examen = "Registra lo encontrado al examinar.";
  const higiene = t("higiene") || null;
  if (higiene && !HIGIENE.includes(higiene)) e.higiene = "Elige una opción.";

  // Diagnóstico CIE-10
  const cie10 = leerCodigoCie10(t("cie10"));
  if (!cie10 || !contexto.codigosCie10.has(cie10)) e.cie10 = "Elige un código CIE-10 válido (p. ej. K02.1).";
  const tipoDx = t("tipo_dx") || "definitivo";
  if (tipoDx !== "presuntivo" && tipoDx !== "definitivo") e.tipo_dx = "Elige presuntivo o definitivo.";
  const piezaDx = t("pieza_dx").trim() || null;
  if (piezaDx && !(/^\d{2}$/.test(piezaDx) && esPiezaFdi(Number(piezaDx)))) e.pieza_dx = "Pieza FDI de dos dígitos: 11–48 o 51–85.";

  // Tratamiento realizado: procedimientos del catálogo, cada uno en una o varias piezas
  const items: DatosAtencion["items"] = [];
  for (let n = 0; n < FILAS_PROCEDIMIENTO; n++) {
    const id = t(`procedimiento_${n}`);
    const textoPiezas = t(`piezas_${n}`);
    if (!id) {
      if (textoPiezas.trim()) e.procedimientos = "Elige el procedimiento de cada fila con piezas.";
      continue;
    }
    const proc = contexto.procedimientos.find((p) => p.id === id);
    if (!proc) { e.procedimientos = "Elige procedimientos del catálogo."; continue; }
    if (proc.requiere_consentimiento) {
      e.procedimientos = `«${proc.nombre}» requiere consentimiento informado firmado: regístralo con el flujo completo.`;
      continue;
    }
    const piezas = leerListaPiezas(textoPiezas);
    const malas = piezas.filter((p) => !(/^\d{2}$/.test(p) && esPiezaFdi(Number(p))));
    if (malas.length > 0) { e.procedimientos = `Pieza FDI inválida: ${malas.join(", ")}.`; continue; }
    for (const p of piezas.length > 0 ? piezas : [null]) items.push({ procedimiento_id: id, pieza: p });
  }
  if (items.length === 0 && !e.procedimientos) e.procedimientos = "Indica al menos un procedimiento realizado.";
  if (items.length > MAX_PIEZAS) e.procedimientos = `Máximo ${MAX_PIEZAS} procedimientos por atención.`;

  // Lo realizado en la sesión
  const descripcion = texto("descripcion", 4000, "descripcion", "Descripción");
  if (!descripcion || descripcion.length < 3) e.descripcion = "Escribe la descripción de lo realizado.";
  const anestesiaTipo = texto("anestesia_tipo", 100, "anestesia_tipo", "Anestesia");
  const anestesiaCantidad = texto("anestesia_cantidad", 100, "anestesia_cantidad", "Cantidad de anestesia");
  const indicaciones = texto("indicaciones", 2000, "indicaciones", "Indicaciones");
  const proxima = texto("proxima_cita", 200, "proxima_cita", "Próxima cita");

  if (Object.keys(e).length > 0) return { ok: false, errores: e };
  return {
    ok: true,
    datos: {
      historia: {
        motivo_consulta: motivo ?? "", tiempo_enfermedad: tiempo, alergias_preguntadas: true, alergias,
        anticoagulado: anticoag === "si", anticoagulante: anticoag === "si" ? anticoagulante : null, embarazo, medicacion,
      },
      examen: { observaciones: examen ?? "", higiene },
      diagnostico: { cie10: cie10 ?? "", tipo: tipoDx as "presuntivo" | "definitivo", pieza: piezaDx },
      items,
      evolucion: {
        texto: descripcion ?? "", anestesia_tipo: anestesiaTipo, anestesia_cantidad: anestesiaCantidad, indicaciones,
        proxima_cita: proxima,
      },
    },
  };
}
