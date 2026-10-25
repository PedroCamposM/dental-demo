// Etapa 21: atención rápida como ficha en una página (formato de la clínica piloto,
// docs/clinica-piloto). La anamnesis de la ficha pide lo mismo que su hoja de papel —motivo de
// consulta, enfermedad actual, alergias y antecedentes— y lo que la seguridad del paciente no
// deja fuera (anticoagulantes y, si corresponde, embarazo). Lo demás del cuestionario se copia de
// la versión vigente: la nueva versión no borra nada de lo registrado antes.
import { validarCuestionario, type CampoCuestionario, type CuestionarioValidado } from "@/lib/historia/cuestionario";

/** Campos que la ficha rápida muestra y envía. */
export const CAMPOS_FICHA = [
  "motivo_consulta", "enfermedad_actual", "alergias", "alergias_ninguna", "enfermedades", "enfermedades_otras",
  "antecedentes_familiares", "medicacion", "anticoagulado", "anticoagulante", "embarazo", "semanas_gestacion",
] as const;

/** Lo que la ficha no pregunta y se conserva de la versión anterior. */
type Previo = Partial<CuestionarioValidado> | null;

const COPIADOS: CampoCuestionario[] = [
  "tiempo_enfermedad", "forma_inicio", "funciones_biologicas", "cirugias", "hospitalizaciones", "habitos_otros",
  "antecedentes_odontologicos", "observaciones",
];

export function validarAnamnesisRapida(
  e: { texto: (c: string) => string; lista: (c: string) => string[] },
  previo: Previo,
  puedeGestar: boolean,
): { ok: true; datos: CuestionarioValidado } | { ok: false; errores: Partial<Record<CampoCuestionario | "alergias", string>> } {
  // Alergias: se preguntan siempre (se escriben o se marca «ninguna conocida»).
  const ninguna = e.texto("alergias_ninguna") === "1";
  const escritas = e.texto("alergias").trim();
  if (!ninguna && !escritas) return { ok: false, errores: { alergias: "Pregunta por las alergias: escríbelas o marca «Ninguna conocida»." } };
  if (ninguna && escritas) return { ok: false, errores: { alergias: "Marcaste «Ninguna conocida» y escribiste alergias: deja una de las dos." } };

  const texto = (c: string): string => {
    if ((CAMPOS_FICHA as readonly string[]).includes(c)) return e.texto(c);
    if ((COPIADOS as string[]).includes(c)) {
      const v = previo?.[c as CampoCuestionario];
      return typeof v === "string" ? v : "";
    }
    if (c === "lactancia") return previo?.lactancia ? "1" : "";
    return "";
  };
  const lista = (c: string): string[] => {
    if (c === "enfermedades") return e.lista("enfermedades");
    if (c === "habitos") return [...(previo?.habitos ?? [])];
    return [];
  };
  return validarCuestionario({ texto, lista }, puedeGestar);
}
