// Validación de un hallazgo del odontograma contra el catálogo NTS 188 (sección 6.1).
// Repite en el servidor lo que la base exige (privado.validar_hallazgo) para dar
// mensajes claros en español; la base vuelve a validar.
import { esPiezaFdi, superficiesImposibles, SUPERFICIES, type Superficie } from "@/lib/clinico/diagnostico";

export type Ambito = "pieza" | "superficie" | "rango" | "entre_piezas" | "arcada";
export type ItemCatalogo = {
  codigo: string; numeral: string; nombre: string; ambito: Ambito; color: "azul" | "rojo" | "segun_estado";
  siglas: string[]; sigla_obligatoria: boolean; multiples_siglas: boolean; requiere_grado: boolean;
};

export const TIPOS_ODONTOGRAMA = {
  inicial: "Inicial (inicio del plan)",
  evolucion: "Evolución (nuevos hallazgos)",
  alta: "Alta (culminación del plan)",
} as const;
export type TipoOdontograma = keyof typeof TIPOS_ODONTOGRAMA;
export const DENTICIONES = { permanente: "Permanente", temporal: "Temporal", mixta: "Mixta" } as const;
export type Denticion = keyof typeof DENTICIONES;

/** Significado de cada sigla (NTS 188, 6.1), para mostrarlo al elegirla. */
export const SIGNIFICADO_SIGLAS: Record<string, string> = {
  CM: "Corona metálica", CF: "Corona fenestrada", CMC: "Corona metal-cerámica", CV: "Corona veneer",
  CLM: "Corona libre de metal", CT: "Corona temporal", O: "Opacidades", PE: "Pigmentación del esmalte",
  FFP: "Fosas y fisuras profundas", I: "Impactación", IMP: "Implante", MB: "Mancha blanca",
  CE: "Caries del esmalte", CD: "Caries de la dentina", CDP: "Caries de la dentina con compromiso pulpar",
  MAC: "Macrodoncia", MIC: "Microdoncia", DNE: "Diente no erupcionado", DEX: "Ausente por extracción (caries)",
  DAO: "Ausente por otras razones", E: "Ectópica", S: "Supernumeraria / sellante", PP: "Pulpotomía",
  M: "Mesializado", D: "Distalizado", V: "Vestibularizado", P: "Palatinizado", L: "Lingualizado",
  RR: "Remanente radicular", AM: "Amalgama", R: "Resina", IV: "Ionómero de vidrio", IM: "Incrustación metálica",
  IE: "Incrustación estética", C: "Carilla", DES: "Desgaste", TC: "Tratamiento de conductos", PC: "Pulpectomía",
};

const cuadrante = (p: number) => Math.floor(p / 10);
const superior = (p: number) => [1, 2, 5, 6].includes(cuadrante(p));
const temporal = (p: number) => cuadrante(p) >= 5;

/** Piezas vecinas: consecutivas en el cuadrante o los dos centrales a cada lado de la línea media. */
export function piezasVecinas(a: number, b: number): boolean {
  if (cuadrante(a) === cuadrante(b)) return Math.abs((a % 10) - (b % 10)) === 1;
  const par = [cuadrante(a), cuadrante(b)].sort().join("");
  return a % 10 === 1 && b % 10 === 1 && ["12", "34", "56", "78"].includes(par);
}

export type HallazgoValidado = {
  hallazgo_codigo: string; pieza: number | null; pieza_hasta: number | null; arcada: "superior" | "inferior" | null;
  superficies: Superficie[] | null; siglas: string[]; estado: "bueno" | "malo" | null; grado: number | null;
  especificacion: string | null;
};
export type CampoHallazgo = "hallazgo_codigo" | "pieza" | "pieza_hasta" | "arcada" | "superficies" | "siglas" | "estado"
  | "grado" | "especificacion";

export function validarHallazgo(
  e: { texto: (c: string) => string; lista: (c: string) => string[] }, catalogo: ItemCatalogo[],
): { ok: true; datos: HallazgoValidado } | { ok: false; errores: Partial<Record<CampoHallazgo, string>> } {
  const errores: Partial<Record<CampoHallazgo, string>> = {};
  const c = catalogo.find((x) => x.codigo === e.texto("hallazgo_codigo"));
  if (!c) return { ok: false, errores: { hallazgo_codigo: "Elige el hallazgo de la lista." } };

  const leerPieza = (campo: "pieza" | "pieza_hasta"): number | null => {
    const t = e.texto(campo).trim();
    if (!t) return null;
    const n = /^\d{2}$/.test(t) ? Number(t) : NaN;
    if (!esPiezaFdi(n)) { errores[campo] = "Pieza FDI de dos dígitos: 11–48 o 51–85."; return null; }
    return n;
  };
  let pieza = leerPieza("pieza");
  let piezaHasta = leerPieza("pieza_hasta");
  let arcada: "superior" | "inferior" | null = null;

  if (c.ambito === "pieza" || c.ambito === "superficie") {
    if (pieza === null && !errores.pieza) errores.pieza = "Elige la pieza en el gráfico o escribe su número.";
    piezaHasta = null;
  } else if (c.ambito === "rango" || c.ambito === "entre_piezas") {
    if (pieza === null && !errores.pieza) errores.pieza = "Indica la primera pieza.";
    if (piezaHasta === null && !errores.pieza_hasta) errores.pieza_hasta = "Indica la otra pieza.";
    if (pieza !== null && piezaHasta !== null) {
      if (pieza === piezaHasta || superior(pieza) !== superior(piezaHasta)) {
        errores.pieza_hasta = "Debe ser otra pieza de la misma arcada.";
      } else if (c.ambito === "entre_piezas" && temporal(pieza) === temporal(piezaHasta) && !piezasVecinas(pieza, piezaHasta)) {
        errores.pieza_hasta = "Las piezas deben ser vecinas.";
      } else if (c.codigo === "transposicion" && cuadrante(pieza) !== cuadrante(piezaHasta)) {
        errores.pieza_hasta = "La transposición es entre piezas del mismo cuadrante.";
      }
    }
  } else {
    const a = e.texto("arcada");
    arcada = a === "superior" || a === "inferior" ? a : null;
    if (!arcada) errores.arcada = "Elige la arcada.";
    pieza = null;
    piezaHasta = null;
  }

  let superficies: Superficie[] | null = null;
  if (c.ambito === "superficie") {
    superficies = [...new Set(e.lista("superficies"))].filter((s): s is Superficie => Object.hasOwn(SUPERFICIES, s));
    if (superficies.length === 0) errores.superficies = "Marca al menos una superficie.";
  }

  const siglas = [...new Set(e.lista("siglas"))].filter((s) => c.siglas.includes(s));
  if (c.sigla_obligatoria && siglas.length === 0) errores.siglas = "Elige la sigla.";
  if (!c.multiples_siglas && siglas.length > 1) errores.siglas = "Este hallazgo lleva una sola sigla.";

  let estado: "bueno" | "malo" | null = null;
  if (c.color === "segun_estado") {
    const v = e.texto("estado");
    estado = v === "bueno" || v === "malo" ? v : null;
    if (!estado) errores.estado = "Indica si está en buen estado (azul) o mal estado (rojo).";
  }

  let grado: number | null = null;
  if (c.requiere_grado) {
    const g = e.texto("grado").trim();
    grado = /^\d$/.test(g) ? Number(g) : NaN;
    if (!(grado >= 1)) { errores.grado = "Indica el grado (número entero desde 1)."; grado = null; }
  }

  const especificacion = e.texto("especificacion").trim() || null;
  if (especificacion && especificacion.length > 300) errores.especificacion = "Máximo 300 caracteres.";

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      hallazgo_codigo: c.codigo, pieza, pieza_hasta: piezaHasta, arcada, superficies: superficies && superficies.length ? superficies : null,
      siglas, estado, grado, especificacion,
    },
  };
}

/** Máximo de piezas en un solo registro (una boca completa permanente). */
export const MAX_PIEZAS = 32;

/** «16, 26 36;46» → ["16", "26", "36", "46"] (sin repetir, en el orden escrito). */
export function leerListaPiezas(texto: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).filter(Boolean))];
}

/** La pieza existe en la dentición del odontograma (en la mixta, todas). */
export function piezaEnDenticion(pieza: number, denticion: Denticion): boolean {
  const temp = cuadrante(pieza) >= 5;
  return denticion === "mixta" || (denticion === "temporal" ? temp : !temp);
}

/**
 * Valida uno o varios hallazgos iguales. Los que se registran por pieza o por superficie
 * admiten varias piezas a la vez (p. ej. caries oclusal en 16, 26, 36 y 46): se devuelve un
 * hallazgo por pieza, cada uno con su propio registro, como exige la norma.
 */
export function validarHallazgos(
  e: { texto: (c: string) => string; lista: (c: string) => string[] }, catalogo: ItemCatalogo[], denticion: Denticion,
): { ok: true; datos: HallazgoValidado[] } | { ok: false; errores: Partial<Record<CampoHallazgo, string>> } {
  const c = catalogo.find((x) => x.codigo === e.texto("hallazgo_codigo"));
  const piezas = leerListaPiezas(e.texto("pieza"));
  const variasPermitidas = c?.ambito === "pieza" || c?.ambito === "superficie";
  if (!c || piezas.length <= 1 || !variasPermitidas) {
    if (c && !variasPermitidas && piezas.length > 1) {
      return { ok: false, errores: { pieza: "Este hallazgo se registra con una sola pieza de inicio." } };
    }
    // Con una sola pieza se valida ya limpia («16,» o «16, 16» son la 16).
    const r = validarHallazgo(piezas.length === 1 ? { texto: (k) => (k === "pieza" ? piezas[0] ?? "" : e.texto(k)), lista: e.lista } : e, catalogo);
    if (!r.ok) return r;
    return revisarPiezas([r.datos], denticion);
  }
  if (piezas.length > MAX_PIEZAS) return { ok: false, errores: { pieza: `Máximo ${MAX_PIEZAS} piezas a la vez.` } };

  const datos: HallazgoValidado[] = [];
  for (const p of piezas) {
    const r = validarHallazgo({ texto: (k) => (k === "pieza" ? p : e.texto(k)), lista: e.lista }, catalogo);
    if (!r.ok) {
      const { pieza, ...otros } = r.errores;
      return { ok: false, errores: pieza ? { ...otros, pieza: `Pieza ${p}: ${pieza.charAt(0).toLowerCase()}${pieza.slice(1)}` } : otros };
    }
    datos.push(r.datos);
  }
  return revisarPiezas(datos, denticion);
}

/** Lo que depende de cada pieza: que exista en la dentición y que tenga esas superficies. */
function revisarPiezas(
  datos: HallazgoValidado[], denticion: Denticion,
): { ok: true; datos: HallazgoValidado[] } | { ok: false; errores: Partial<Record<CampoHallazgo, string>> } {
  const fuera = datos.flatMap((d) => [d.pieza, d.pieza_hasta]).filter((p): p is number => p !== null && !piezaEnDenticion(p, denticion));
  if (fuera.length > 0) {
    return { ok: false, errores: { pieza: `${fuera.length > 1 ? "Las piezas" : "La pieza"} ${fuera.join(", ")} no ${fuera.length > 1 ? "corresponden" : "corresponde"} a la dentición ${DENTICIONES[denticion].toLowerCase()} de este odontograma.` } };
  }
  for (const d of datos) {
    if (d.pieza === null || !d.superficies) continue;
    const malas = superficiesImposibles(d.pieza, d.superficies);
    if (malas.length > 0) {
      return { ok: false, errores: { superficies: `La pieza ${d.pieza} no tiene superficie ${malas.map((m) => SUPERFICIES[m].toLowerCase()).join(" ni ")}.` } };
    }
  }
  return { ok: true, datos };
}

/** Texto corto de la ubicación de un hallazgo. */
export function ubicacion(h: { pieza: number | null; pieza_hasta: number | null; arcada: string | null; superficies: string[] | null }): string {
  if (h.arcada) return `Arcada ${h.arcada}`;
  if (h.pieza !== null && h.pieza_hasta !== null) return `${h.pieza}–${h.pieza_hasta}`;
  if (h.pieza === null) return "—";
  const s = (h.superficies ?? []).map((x) => SUPERFICIES[x as Superficie] ?? x).join(", ").toLowerCase();
  return s ? `${h.pieza} (${s})` : String(h.pieza);
}
