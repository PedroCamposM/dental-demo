// Periodontograma (Etapa 9): validación en el servidor, nivel de inserción y resumen.
// La base vuelve a validar (rangos, seis sitios, borrador, responsable).
//
// Convención (ver la migración 0919): seis sitios por pieza en orden MV, V, DV, MP/ML,
// P/L, DP/DL. NIC = PS + MG, con MG positivo en recesión (margen apical al límite
// amelocementario) y negativo cuando el margen está coronal. Movilidad y furca: grado 0 a 3.
// Sin IA ni diagnóstico automático (regla 11): solo cuentas de lo registrado.

/** Arcadas en el orden en que se dibujan (FDI, dentición permanente). */
export const SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const;
export const INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const;
export const PIEZAS_PERIODONTO: readonly number[] = [...SUPERIOR, ...INFERIOR];

/** Piezas con furca (molares y primeros premolares superiores). */
export function tieneFurca(pieza: number): boolean {
  const n = pieza % 10;
  return n >= 6 || ((pieza === 14 || pieza === 24));
}

export const esSuperior = (pieza: number) => pieza < 30;

/** Nombre de los sitios según la arcada: palatino arriba, lingual abajo. */
export function nombresSitios(pieza: number): readonly string[] {
  return esSuperior(pieza) ? ["MV", "V", "DV", "MP", "P", "DP"] : ["MV", "V", "DV", "ML", "L", "DL"];
}

export type Seis<T> = [T, T, T, T, T, T];
export type PiezaPeriodonto = {
  pieza: number;
  ausente: boolean;
  implante: boolean;
  movilidad: number | null;
  furca: number | null;
  ps: Seis<number | null>;
  mg: Seis<number | null>;
  sangrado: Seis<boolean>;
  supuracion: Seis<boolean>;
  placa: Seis<boolean>;
};

export const seisNulos = (): Seis<number | null> => [null, null, null, null, null, null];
export const seisFalsos = (): Seis<boolean> => [false, false, false, false, false, false];

export function piezaVacia(pieza: number): PiezaPeriodonto {
  return {
    pieza, ausente: false, implante: false, movilidad: null, furca: null,
    ps: seisNulos(), mg: seisNulos(), sangrado: seisFalsos(), supuracion: seisFalsos(), placa: seisFalsos(),
  };
}

/** NIC de un sitio (null si falta PS o MG). */
export function nic(ps: number | null, mg: number | null): number | null {
  return ps === null || mg === null ? null : ps + mg;
}

/** ¿La pieza tiene algo registrado? (Las vacías no se envían.) */
export function tieneDatos(p: PiezaPeriodonto): boolean {
  return p.ausente || p.implante || p.movilidad !== null || p.furca !== null
    || p.ps.some((x) => x !== null) || p.mg.some((x) => x !== null)
    || p.sangrado.some(Boolean) || p.supuracion.some(Boolean) || p.placa.some(Boolean);
}

const LIMITES = { ps: [0, 20], mg: [-10, 20] } as const;

function seisNumeros(v: unknown, campo: "ps" | "mg", pieza: number): Seis<number | null> | string {
  const nombre = campo === "ps" ? "profundidad de sondaje" : "margen gingival";
  if (v === undefined || v === null) return seisNulos();
  if (!Array.isArray(v) || v.length !== 6) return `Pieza ${pieza}: la ${nombre} debe tener seis sitios.`;
  const [min, max] = LIMITES[campo];
  const salida: (number | null)[] = [];
  for (const x of v) {
    if (x === null || x === "") { salida.push(null); continue; }
    const n = typeof x === "number" ? x : Number(String(x).trim());
    if (!Number.isInteger(n)) return `Pieza ${pieza}: la ${nombre} va en milímetros enteros.`;
    if (n < min || n > max) return `Pieza ${pieza}: la ${nombre} debe estar entre ${min} y ${max} mm.`;
    salida.push(n);
  }
  return salida as Seis<number | null>;
}

function seisMarcas(v: unknown): Seis<boolean> {
  if (!Array.isArray(v) || v.length !== 6) return seisFalsos();
  return v.map((x) => x === true) as Seis<boolean>;
}

function grado(v: unknown, pieza: number, que: string): number | null | string {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 3) return `Pieza ${pieza}: ${que} va de 0 a 3.`;
  return n;
}

/**
 * Valida lo que envía la grilla (JSON): las piezas con datos y las ya guardadas que se
 * vaciaron. Una pieza ausente no lleva mediciones.
 */
export function validarPiezas(json: string):
  { ok: true; piezas: PiezaPeriodonto[] } | { ok: false; error: string } {
  let datos: unknown;
  try {
    datos = JSON.parse(json);
  } catch {
    return { ok: false, error: "No se pudieron leer las mediciones. Recarga la página." };
  }
  if (!Array.isArray(datos) || datos.length > 32) return { ok: false, error: "Mediciones inválidas." };
  const vistas = new Set<number>();
  const piezas: PiezaPeriodonto[] = [];
  for (const d of datos as unknown[]) {
    if (typeof d !== "object" || d === null) return { ok: false, error: "Mediciones inválidas." };
    const o = d as Record<string, unknown>;
    const pieza = Number(o.pieza);
    if (!PIEZAS_PERIODONTO.includes(pieza) || vistas.has(pieza)) return { ok: false, error: "Pieza inválida." };
    vistas.add(pieza);
    const ps = seisNumeros(o.ps, "ps", pieza);
    if (typeof ps === "string") return { ok: false, error: ps };
    const mg = seisNumeros(o.mg, "mg", pieza);
    if (typeof mg === "string") return { ok: false, error: mg };
    const movilidad = grado(o.movilidad, pieza, "la movilidad");
    if (typeof movilidad === "string") return { ok: false, error: movilidad };
    const furca = grado(o.furca, pieza, "la furca");
    if (typeof furca === "string") return { ok: false, error: furca };
    const p: PiezaPeriodonto = {
      pieza, ausente: o.ausente === true, implante: o.implante === true, movilidad, furca: tieneFurca(pieza) ? furca : null,
      ps, mg, sangrado: seisMarcas(o.sangrado), supuracion: seisMarcas(o.supuracion), placa: seisMarcas(o.placa),
    };
    if (p.ausente && (p.movilidad !== null || p.furca !== null || p.ps.some((x) => x !== null) || p.mg.some((x) => x !== null))) {
      return { ok: false, error: `Pieza ${pieza}: una pieza ausente no lleva mediciones.` };
    }
    // Se guarda también una pieza vacía: así se borra lo que se había registrado en el borrador.
    piezas.push(p);
  }
  return { ok: true, piezas };
}

export type Resumen = {
  piezasPresentes: number;
  sitios: number;            // sitios con PS registrada
  sangrado: number | null;   // % de sitios con sangrado al sondaje (sobre los sondados)
  placa: number | null;      // % de sitios con placa (sobre los de piezas presentes)
  ps4: number;               // sitios con PS ≥ 4 mm
  ps6: number;               // sitios con PS ≥ 6 mm
  nicMedio: number | null;   // promedio de NIC (mm, un decimal)
};

/** Cuentas descriptivas de lo registrado (no es un diagnóstico). */
export function resumen(piezas: PiezaPeriodonto[]): Resumen {
  const presentes = piezas.filter((p) => !p.ausente);
  let sitios = 0, conSangrado = 0, conPlaca = 0, ps4 = 0, ps6 = 0, sumaNic = 0, nNic = 0;
  for (const p of presentes) {
    p.ps.forEach((v, i) => {
      if (v === null) return;
      sitios++;
      if (p.sangrado[i]) conSangrado++;
      if (v >= 4) ps4++;
      if (v >= 6) ps6++;
      const n = nic(v, p.mg[i] ?? null);
      if (n !== null) { sumaNic += n; nNic++; }
    });
    conPlaca += p.placa.filter(Boolean).length;
  }
  const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 100));
  return {
    piezasPresentes: presentes.length, sitios, sangrado: pct(conSangrado, sitios),
    placa: pct(conPlaca, presentes.length * 6), ps4, ps6, nicMedio: nNic === 0 ? null : Math.round((sumaNic / nNic) * 10) / 10,
  };
}

export type CambioSitio = { pieza: number; sitio: string; antes: number; despues: number; diferencia: number };

/**
 * Comparación entre dos fechas: sitios cuyo NIC (o, sin MG, la PS) cambió en 2 mm o más.
 * Diferencia positiva: más pérdida de inserción (o bolsa más profunda) en la fecha posterior.
 */
export function comparar(antes: PiezaPeriodonto[], despues: PiezaPeriodonto[], umbral = 2): CambioSitio[] {
  const mapa = new Map(antes.map((p) => [p.pieza, p]));
  const cambios: CambioSitio[] = [];
  for (const d of despues) {
    const a = mapa.get(d.pieza);
    if (!a || a.ausente || d.ausente) continue;
    const nombres = nombresSitios(d.pieza);
    for (let i = 0; i < 6; i++) {
      // NIC si ambas fechas tienen MG en el sitio; si no, PS en ambas (no se mezclan).
      const conMg = a.mg[i] != null && d.mg[i] != null;
      const va = conMg ? nic(a.ps[i] ?? null, a.mg[i] ?? null) : a.ps[i] ?? null;
      const vd = conMg ? nic(d.ps[i] ?? null, d.mg[i] ?? null) : d.ps[i] ?? null;
      if (va === null || vd === null) continue;
      if (Math.abs(vd - va) >= umbral) {
        cambios.push({ pieza: d.pieza, sitio: nombres[i] ?? String(i + 1), antes: va, despues: vd, diferencia: vd - va });
      }
    }
  }
  return cambios.sort((x, y) => y.diferencia - x.diferencia || x.pieza - y.pieza);
}
