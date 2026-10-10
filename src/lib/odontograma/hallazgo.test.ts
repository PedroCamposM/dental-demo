import { describe, expect, it } from "vitest";
import { leerListaPiezas, piezasVecinas, ubicacion, validarHallazgo, validarHallazgos, type ItemCatalogo } from "./hallazgo";

const item = (codigo: string, o: Partial<ItemCatalogo>): ItemCatalogo => ({
  codigo, numeral: "6.1.x", nombre: codigo, ambito: "pieza", color: "azul", siglas: [], sigla_obligatoria: false,
  multiples_siglas: false, requiere_grado: false, ...o,
});
const CATALOGO = [
  item("caries", { ambito: "superficie", color: "rojo", siglas: ["MB", "CE", "CD", "CDP"], sigla_obligatoria: true }),
  item("corona", { color: "segun_estado", siglas: ["CM", "CMC"], sigla_obligatoria: true }),
  item("diastema", { ambito: "entre_piezas" }),
  item("transposicion", { ambito: "entre_piezas" }),
  item("protesis_parcial_fija", { ambito: "rango", color: "segun_estado" }),
  item("edentulo_total", { ambito: "arcada" }),
  item("movilidad_patologica", { color: "rojo", requiere_grado: true }),
  item("posicion_anormal", { siglas: ["M", "D", "V"], sigla_obligatoria: true, multiples_siglas: true }),
];
const entrada = (t: Record<string, string>, l: Record<string, string[]> = {}) => ({
  texto: (c: string) => t[c] ?? "", lista: (c: string) => l[c] ?? [],
});

describe("validarHallazgo (NTS 188, 6.1)", () => {
  it("caries por superficie con su sigla", () => {
    const r = validarHallazgo(entrada({ hallazgo_codigo: "caries", pieza: "36" }, { superficies: ["oclusal", "x"], siglas: ["CD"] }), CATALOGO);
    expect(r).toMatchObject({ ok: true, datos: { pieza: 36, superficies: ["oclusal"], siglas: ["CD"], estado: null } });
  });

  it("exige superficie, sigla y estado según el hallazgo", () => {
    const caries = validarHallazgo(entrada({ hallazgo_codigo: "caries", pieza: "36" }), CATALOGO);
    expect(caries.ok === false && Object.keys(caries.errores).sort()).toEqual(["siglas", "superficies"]);
    const corona = validarHallazgo(entrada({ hallazgo_codigo: "corona", pieza: "11" }, { siglas: ["CM", "CMC"] }), CATALOGO);
    expect(corona.ok === false && Object.keys(corona.errores).sort()).toEqual(["estado", "siglas"]);
  });

  it("entre piezas: vecinas; la transposición, en el mismo cuadrante", () => {
    expect(validarHallazgo(entrada({ hallazgo_codigo: "diastema", pieza: "11", pieza_hasta: "21" }), CATALOGO).ok).toBe(true);
    const lejos = validarHallazgo(entrada({ hallazgo_codigo: "diastema", pieza: "11", pieza_hasta: "13" }), CATALOGO);
    expect(lejos.ok === false && lejos.errores.pieza_hasta).toBe("Las piezas deben ser vecinas.");
    const cruzada = validarHallazgo(entrada({ hallazgo_codigo: "transposicion", pieza: "11", pieza_hasta: "21" }), CATALOGO);
    expect(cruzada.ok === false && cruzada.errores.pieza_hasta).toBe("La transposición es entre piezas del mismo cuadrante.");
    const arcadas = validarHallazgo(entrada({ hallazgo_codigo: "protesis_parcial_fija", pieza: "13", pieza_hasta: "43", estado: "bueno" }), CATALOGO);
    expect(arcadas.ok === false && arcadas.errores.pieza_hasta).toBe("Debe ser otra pieza de la misma arcada.");
  });

  it("arcada, grado y varias siglas", () => {
    expect(validarHallazgo(entrada({ hallazgo_codigo: "edentulo_total", arcada: "inferior", pieza: "36" }), CATALOGO))
      .toMatchObject({ ok: true, datos: { arcada: "inferior", pieza: null } });
    const sinGrado = validarHallazgo(entrada({ hallazgo_codigo: "movilidad_patologica", pieza: "31" }), CATALOGO);
    expect(sinGrado.ok === false && sinGrado.errores.grado).toBeTruthy();
    expect(validarHallazgo(entrada({ hallazgo_codigo: "posicion_anormal", pieza: "24" }, { siglas: ["D", "V"] }), CATALOGO).ok).toBe(true);
  });

  it("piezas vecinas y texto de ubicación", () => {
    expect([piezasVecinas(11, 21), piezasVecinas(41, 31), piezasVecinas(13, 14), piezasVecinas(11, 22), piezasVecinas(51, 61)])
      .toEqual([true, true, true, false, true]);
    expect(ubicacion({ pieza: 36, pieza_hasta: null, arcada: null, superficies: ["oclusal", "mesial"] })).toBe("36 (oclusal, mesial)");
    expect(ubicacion({ pieza: 13, pieza_hasta: 15, arcada: null, superficies: null })).toBe("13–15");
  });
});

describe("varias piezas a la vez (Etapa 13)", () => {
  it("lee la lista de piezas con comas, espacios o punto y coma, sin repetir", () => {
    expect(leerListaPiezas(" 16, 26 36;46 16 ")).toEqual(["16", "26", "36", "46"]);
    expect(leerListaPiezas("")).toEqual([]);
  });

  it("un hallazgo por pieza, con las mismas superficies y sigla", () => {
    const r = validarHallazgos(entrada({ hallazgo_codigo: "caries", pieza: "16, 26, 36" }, { superficies: ["oclusal"], siglas: ["CE"] }), CATALOGO, "permanente");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.map((d) => d.pieza)).toEqual([16, 26, 36]);
      expect(r.datos.every((d) => d.superficies?.join() === "oclusal" && d.siglas.join() === "CE")).toBe(true);
    }
  });

  it("dice qué pieza está mal escrita", () => {
    const r = validarHallazgos(entrada({ hallazgo_codigo: "corona", pieza: "16 19", estado: "bueno" }, { siglas: ["CM"] }), CATALOGO, "permanente");
    expect(r).toMatchObject({ ok: false, errores: { pieza: "Pieza 19: pieza FDI de dos dígitos: 11–48 o 51–85." } });
  });

  it("rechaza una superficie que la pieza no tiene (oclusal en un incisivo)", () => {
    const r = validarHallazgos(entrada({ hallazgo_codigo: "caries", pieza: "16 11" }, { superficies: ["oclusal"], siglas: ["CD"] }), CATALOGO, "permanente");
    expect(r).toMatchObject({ ok: false, errores: { superficies: "La pieza 11 no tiene superficie oclusal." } });
  });

  it("rechaza piezas de otra dentición", () => {
    const r = validarHallazgos(entrada({ hallazgo_codigo: "corona", pieza: "16 55", estado: "malo" }, { siglas: ["CM"] }), CATALOGO, "permanente");
    expect(r).toMatchObject({ ok: false, errores: { pieza: "La pieza 55 no corresponde a la dentición permanente de este odontograma." } });
    expect(validarHallazgos(entrada({ hallazgo_codigo: "corona", pieza: "16 55", estado: "malo" }, { siglas: ["CM"] }), CATALOGO, "mixta").ok).toBe(true);
  });

  it("los hallazgos entre piezas, por rango o por arcada no admiten una lista", () => {
    const r = validarHallazgos(entrada({ hallazgo_codigo: "diastema", pieza: "11 21", pieza_hasta: "22" }), CATALOGO, "permanente");
    expect(r).toMatchObject({ ok: false, errores: { pieza: "Este hallazgo se registra con una sola pieza de inicio." } });
  });

  it("una sola pieza funciona como antes", () => {
    const r = validarHallazgos(entrada({ hallazgo_codigo: "diastema", pieza: "11", pieza_hasta: "21" }), CATALOGO, "permanente");
    expect(r).toMatchObject({ ok: true, datos: [{ pieza: 11, pieza_hasta: 21 }] });
  });
});
