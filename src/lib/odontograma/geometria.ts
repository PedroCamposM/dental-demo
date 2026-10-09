// Geometría del odontograma según el gráfico único de la NTS 188 (5.17 y Anexo,
// ver docs/nts188-resumen.md, 1.3 y 1.4): cuatro filas fijas —permanentes
// superiores, temporales superiores, temporales inferiores y permanentes
// inferiores—, con la derecha del paciente a la izquierda del gráfico.
//
// Lo que la norma NO define (1.3): qué zona de la corona es cada superficie. Se usa
// la convención habitual, pendiente de confirmar por el odontólogo de la clínica:
//   - superiores: zona hacia la raíz = vestibular; hacia el centro del gráfico = palatino;
//   - inferiores: zona hacia el centro del gráfico = lingual; hacia la raíz = vestibular;
//   - mesial = lado hacia la línea media; distal = el opuesto;
//   - centro = oclusal (posteriores) o incisal (anteriores).

export type Superficie = "vestibular" | "palatino" | "lingual" | "mesial" | "distal" | "oclusal" | "incisal";
export type Zona = "arriba" | "abajo" | "izquierda" | "derecha" | "centro";
export type Punto = readonly [number, number];

export const ANCHO = 40;          // ancho de cada pieza
export const CORONA = 26;         // lado de la corona
export const RAIZ = 24;           // largo de la raíz (permanentes)
export const RAIZ_TEMPORAL = 18;  // largo de la raíz (temporales)
export const RECUADRO = 18;       // alto del recuadro de siglas
export const NUMERO = 14;         // alto del número de la pieza
const MEDIO = 14;                 // espacio en la línea media
const SEPARACION = 26;            // entre filas
const MARGEN = 8;

export const FILAS = [
  { clave: "permanente_superior", piezas: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] },
  { clave: "temporal_superior", piezas: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65] },
  { clave: "temporal_inferior", piezas: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75] },
  { clave: "permanente_inferior", piezas: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] },
] as const;

export const TODAS_LAS_PIEZAS: number[] = FILAS.flatMap((f) => [...f.piezas]);
export const cuadrante = (p: number) => Math.floor(p / 10);
export const esSuperior = (p: number) => [1, 2, 5, 6].includes(cuadrante(p));
export const esTemporal = (p: number) => cuadrante(p) >= 5;
/** Cuadrantes que quedan a la izquierda del gráfico (derecha del paciente): 1, 4, 5 y 8. */
export const aLaIzquierda = (p: number) => [1, 4, 5, 8].includes(cuadrante(p));

export type Grupo = "molar" | "premolar" | "anterior";
export function grupo(p: number): Grupo {
  const n = p % 10;
  if (esTemporal(p)) return n >= 4 ? "molar" : "anterior";
  return n >= 6 ? "molar" : n >= 4 ? "premolar" : "anterior";
}

/** Raíces dibujadas (Anexo): 3 en molares superiores, 2 en molares inferiores, 1 en el resto;
 *  14 y 24 llevan además una raíz en línea discontinua. */
export function raices(p: number): { cantidad: number; discontinua: boolean } {
  if (grupo(p) === "molar") return { cantidad: esSuperior(p) ? 3 : 2, discontinua: false };
  return { cantidad: 1, discontinua: p === 14 || p === 24 };
}

export const ANCHO_TOTAL = MARGEN * 2 + ANCHO * 16 + MEDIO;
const CENTRO_X = ANCHO_TOTAL / 2;

/** Centro horizontal de la pieza: la 51 queda bajo la 11, la 55 bajo la 15, etc. */
export function centroX(p: number): number {
  const i = p % 10;
  const desplazamiento = MEDIO / 2 + (i - 0.5) * ANCHO;
  return aLaIzquierda(p) ? CENTRO_X - desplazamiento : CENTRO_X + desplazamiento;
}

type Fila = { recuadroY: number; numeroY: number; coronaY: number; raizLargo: number; apiceY: number };

/** Posiciones verticales de cada fila. Superiores: recuadro, número, raíces, corona.
 *  Inferiores: corona, raíces, número, recuadro. */
function calcularFilas(): Record<(typeof FILAS)[number]["clave"], Fila> & { alto: number } {
  let y = MARGEN;
  const superior = (raiz: number): Fila => {
    const recuadroY = y;
    const numeroY = recuadroY + RECUADRO;
    const apiceY = numeroY + NUMERO + 4;
    const coronaY = apiceY + raiz;
    y = coronaY + CORONA + SEPARACION;
    return { recuadroY, numeroY, coronaY, raizLargo: raiz, apiceY };
  };
  const inferior = (raiz: number): Fila => {
    const coronaY = y;
    const apiceY = coronaY + CORONA + raiz;
    const numeroY = apiceY + 4;
    const recuadroY = numeroY + NUMERO;
    y = recuadroY + RECUADRO + SEPARACION;
    return { recuadroY, numeroY, coronaY, raizLargo: raiz, apiceY };
  };
  const permanente_superior = superior(RAIZ);
  const temporal_superior = superior(RAIZ_TEMPORAL);
  y += SEPARACION;   // plano oclusal
  const temporal_inferior = inferior(RAIZ_TEMPORAL);
  const permanente_inferior = inferior(RAIZ);
  return { permanente_superior, temporal_superior, temporal_inferior, permanente_inferior, alto: y - SEPARACION + MARGEN };
}
const POSICIONES = calcularFilas();
export const ALTO_TOTAL = POSICIONES.alto;

export function fila(p: number): Fila {
  const clave = esTemporal(p) ? (esSuperior(p) ? "temporal_superior" : "temporal_inferior")
    : (esSuperior(p) ? "permanente_superior" : "permanente_inferior");
  return POSICIONES[clave];
}

/** Rectángulo de la corona: x, y (esquina superior izquierda) y lado. */
export function corona(p: number): { x: number; y: number; lado: number } {
  return { x: centroX(p) - CORONA / 2, y: fila(p).coronaY, lado: CORONA };
}

/** Rectángulo interior (zona central). En anteriores es una franja angosta (borde incisal). */
export function interior(p: number): { x: number; y: number; ancho: number; alto: number } {
  const c = corona(p);
  const ancho = grupo(p) === "anterior" ? CORONA * 0.42 : CORONA * 0.5;
  const alto = grupo(p) === "molar" ? CORONA * 0.5 : grupo(p) === "premolar" ? CORONA * 0.36 : CORONA * 0.12;
  return { x: c.x + (CORONA - ancho) / 2, y: c.y + (CORONA - alto) / 2, ancho, alto };
}

/** Polígono de cada zona de la corona (cuatro trapecios y el centro). */
export function zonas(p: number): Record<Zona, Punto[]> {
  const c = corona(p);
  const i = interior(p);
  const [x0, y0, x1, y1] = [c.x, c.y, c.x + c.lado, c.y + c.lado];
  const [a0, b0, a1, b1] = [i.x, i.y, i.x + i.ancho, i.y + i.alto];
  return {
    arriba: [[x0, y0], [x1, y0], [a1, b0], [a0, b0]],
    abajo: [[x0, y1], [x1, y1], [a1, b1], [a0, b1]],
    izquierda: [[x0, y0], [x0, y1], [a0, b1], [a0, b0]],
    derecha: [[x1, y0], [x1, y1], [a1, b1], [a1, b0]],
    centro: [[a0, b0], [a1, b0], [a1, b1], [a0, b1]],
  };
}

/** Zona de la corona donde se dibuja cada superficie (convención indicada arriba). */
export function zonaDeSuperficie(p: number, s: Superficie): Zona {
  switch (s) {
    case "oclusal":
    case "incisal":
      return "centro";
    case "vestibular":
      return esSuperior(p) ? "arriba" : "abajo";
    case "palatino":
    case "lingual":
      return esSuperior(p) ? "abajo" : "arriba";
    case "mesial":
      return aLaIzquierda(p) ? "derecha" : "izquierda";
    case "distal":
      return aLaIzquierda(p) ? "izquierda" : "derecha";
  }
}

/** Raíces: triángulos desde el borde de la corona hacia el ápice. */
export function poligonosRaiz(p: number): { puntos: Punto[]; discontinua: boolean }[] {
  const c = corona(p);
  const f = fila(p);
  const sup = esSuperior(p);
  const base = sup ? c.y : c.y + c.lado;
  const apice = f.apiceY;
  const { cantidad, discontinua } = raices(p);
  const salida: { puntos: Punto[]; discontinua: boolean }[] = [];
  const ancho = c.lado / cantidad;
  for (let k = 0; k < cantidad; k++) {
    const x0 = c.x + k * ancho;
    salida.push({ puntos: [[x0 + 2, base], [x0 + ancho - 2, base], [x0 + ancho / 2, apice]], discontinua: false });
  }
  if (discontinua) {
    // Del lado que mira a la línea media.
    const xm = aLaIzquierda(p) ? c.x + c.lado - 4 : c.x + 4;
    salida.push({ puntos: [[xm - 4, base], [xm + 4, base], [xm, apice + (sup ? 4 : -4)]], discontinua: true });
  }
  return salida;
}

/** Puntos medios de cada raíz a la altura del ápice (para conductos y aparatos). */
export function centrosDeRaiz(p: number): number[] {
  const c = corona(p);
  const n = raices(p).cantidad;
  return Array.from({ length: n }, (_, k) => c.x + (k + 0.5) * (c.lado / n));
}

export const aTexto = (pts: readonly Punto[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
