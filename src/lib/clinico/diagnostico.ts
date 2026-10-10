// Examen clínico y diagnóstico CIE-10: opciones y validación en el servidor.
// La base vuelve a validar (checks, catálogo, RLS). Nada aquí sugiere diagnósticos:
// el profesional elige el código (regla 11).

export const CAMPOS_EXTRAORAL = {
  atm: "ATM",
  ganglios: "Ganglios",
  asimetrias: "Asimetrías",
  labios: "Labios",
} as const;
export const CAMPOS_INTRAORAL = {
  mucosas: "Mucosas",
  encia: "Encía",
  lengua: "Lengua",
  paladar: "Paladar",
  piso_boca: "Piso de boca",
  oclusion: "Oclusión",
} as const;
export const HIGIENE = { buena: "Buena", regular: "Regular", mala: "Mala" } as const;
export type Higiene = keyof typeof HIGIENE;

type CampoTexto = keyof typeof CAMPOS_EXTRAORAL | keyof typeof CAMPOS_INTRAORAL | "observaciones";
export type CampoExamen = CampoTexto | "higiene";
export type ExamenValidado = Record<CampoTexto, string | null> & { higiene: Higiene | null };

export const CAMPOS_TEXTO_EXAMEN: CampoTexto[] = [
  ...(Object.keys(CAMPOS_EXTRAORAL) as CampoTexto[]), ...(Object.keys(CAMPOS_INTRAORAL) as CampoTexto[]), "observaciones",
];

/** Examen: todo opcional, pero al menos un dato. */
export function validarExamen(texto: (campo: string) => string):
  { ok: true; datos: ExamenValidado } | { ok: false; errores: Partial<Record<CampoExamen | "general", string>> } {
  const errores: Partial<Record<CampoExamen | "general", string>> = {};
  const datos = {} as ExamenValidado;
  for (const c of CAMPOS_TEXTO_EXAMEN) {
    const v = texto(c).trim();
    const max = c === "observaciones" ? 2000 : 500;
    if (v.length > max) errores[c] = `Máximo ${max} caracteres.`;
    datos[c] = v || null;
  }
  const h = texto("higiene");
  datos.higiene = Object.hasOwn(HIGIENE, h) ? (h as Higiene) : null;
  if (h && !datos.higiene) errores.higiene = "Elige buena, regular o mala.";
  if (Object.values(datos).every((v) => v === null)) errores.general = "Registra al menos un dato del examen.";
  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, datos };
}

// ---------------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------------
export const TIPOS_DIAGNOSTICO = { presuntivo: "Presuntivo", definitivo: "Definitivo" } as const;
export type TipoDiagnostico = keyof typeof TIPOS_DIAGNOSTICO;

export const SUPERFICIES = {
  vestibular: "Vestibular",
  palatino: "Palatino",
  lingual: "Lingual",
  mesial: "Mesial",
  distal: "Distal",
  oclusal: "Oclusal",
  incisal: "Incisal",
} as const;
export type Superficie = keyof typeof SUPERFICIES;

/** Pieza FDI (dígito dos): permanentes 11–48 y temporales 51–85. */
export function esPiezaFdi(n: number): boolean {
  const c = Math.floor(n / 10);
  const p = n % 10;
  return Number.isInteger(n) && ((c >= 1 && c <= 4 && p >= 1 && p <= 8) || (c >= 5 && c <= 8 && p >= 1 && p <= 5));
}

/** Superficies que existen en la pieza: palatino en superiores, lingual en inferiores,
 *  incisal en anteriores (x1–x3) y oclusal en posteriores. Devuelve las imposibles. */
export function superficiesImposibles(pieza: number, superficies: Superficie[]): Superficie[] {
  const c = Math.floor(pieza / 10);
  const superior = [1, 2, 5, 6].includes(c);
  const anterior = pieza % 10 <= 3;
  return superficies.filter((s) => (s === "palatino" && !superior) || (s === "lingual" && superior)
    || (s === "incisal" && !anterior) || (s === "oclusal" && anterior));
}

/** «K02.1 — Caries de la dentina» o «k021» → «K02.1». null si no tiene forma de código. */
export function leerCodigoCie10(texto: string): string | null {
  const m = /^\s*([A-Za-z])\s*(\d{2})\.?(\d)?/.exec(texto);
  if (!m) return null;
  return `${m[1]!.toUpperCase()}${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}

export type CodigoCie10 = { codigo: string; descripcion: string; es_categoria: boolean };

/** Códigos que se pueden elegir: subcódigos, y categorías sin subcódigos. */
export function codigosElegibles(catalogo: CodigoCie10[]): CodigoCie10[] {
  return catalogo.filter((c) => !c.es_categoria || !catalogo.some((s) => s.codigo.startsWith(`${c.codigo}.`)));
}

export type DiagnosticoValidado = {
  cie10: string; tipo: TipoDiagnostico; pieza: number | null; superficies: Superficie[] | null; observacion: string | null;
};
export type CampoDiagnostico = "cie10" | "tipo" | "pieza" | "superficies" | "observacion";

export function validarDiagnostico(
  e: { texto: (c: string) => string; lista: (c: string) => string[] }, elegibles: ReadonlySet<string>,
): { ok: true; datos: DiagnosticoValidado } | { ok: false; errores: Partial<Record<CampoDiagnostico, string>> } {
  const errores: Partial<Record<CampoDiagnostico, string>> = {};
  const codigo = leerCodigoCie10(e.texto("cie10"));
  if (!e.texto("cie10").trim()) errores.cie10 = "Busca y elige el código CIE-10.";
  else if (!codigo || !elegibles.has(codigo)) {
    const sub = codigo ? [...elegibles].find((x) => x.startsWith(`${codigo}.`)) : undefined;
    errores.cie10 = sub ? `Elige un subcódigo de ${codigo} (por ejemplo, ${sub}), no la categoría.`
      : "Elige un código CIE-10 de la lista.";
  }
  const t = e.texto("tipo");
  const tipo = Object.hasOwn(TIPOS_DIAGNOSTICO, t) ? (t as TipoDiagnostico) : null;
  if (!tipo) errores.tipo = "Indica si es presuntivo o definitivo.";

  const textoPieza = e.texto("pieza").trim();
  let pieza: number | null = null;
  if (textoPieza) {
    pieza = /^\d{2}$/.test(textoPieza) ? Number(textoPieza) : NaN;
    if (!esPiezaFdi(pieza)) errores.pieza = "Pieza FDI de dos dígitos: 11–48 o 51–85.";
  }
  const sup = [...new Set(e.lista("superficies"))].filter((s): s is Superficie => Object.hasOwn(SUPERFICIES, s));
  if (sup.length > 0 && !textoPieza) errores.superficies = "Indica la pieza de esas superficies.";
  else if (sup.length > 0 && pieza !== null && esPiezaFdi(pieza)) {
    const malas = superficiesImposibles(pieza, sup);
    if (malas.length > 0) {
      errores.superficies = `La pieza ${pieza} no tiene superficie ${malas.map((m) => SUPERFICIES[m].toLowerCase()).join(" ni ")}.`;
    }
  }

  const observacion = e.texto("observacion").trim() || null;
  if (observacion && observacion.length > 1000) errores.observacion = "Máximo 1000 caracteres.";

  if (Object.keys(errores).length > 0 || !codigo || !tipo) return { ok: false, errores };
  return {
    ok: true,
    datos: { cie10: codigo, tipo, pieza: Number.isNaN(pieza) ? null : pieza, superficies: sup.length > 0 ? sup : null, observacion },
  };
}
