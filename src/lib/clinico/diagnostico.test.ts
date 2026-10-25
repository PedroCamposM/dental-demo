import { describe, expect, it } from "vitest";
import {
  codigosElegibles, esPiezaFdi, leerCodigoCie10, superficiesImposibles, validarDiagnostico, validarDiagnosticos, validarExamen,
  type CodigoCie10,
} from "./diagnostico";

const entrada = (textos: Record<string, string>, listas: Record<string, string[]> = {}) => ({
  texto: (c: string) => textos[c] ?? "",
  lista: (c: string) => listas[c] ?? [],
});
const CATALOGO: CodigoCie10[] = [
  { codigo: "K02", descripcion: "Caries dental", es_categoria: true },
  { codigo: "K02.0", descripcion: "Caries limitada al esmalte", es_categoria: false },
  { codigo: "K02.1", descripcion: "Caries de la dentina", es_categoria: false },
  { codigo: "S02.5", descripcion: "Fractura de los dientes", es_categoria: false },
  { codigo: "K99", descripcion: "Categoría sin subcódigos", es_categoria: true },
];
const ELEGIBLES = new Set(codigosElegibles(CATALOGO).map((c) => c.codigo));

describe("CIE-10", () => {
  it("lee el código de lo que muestra el buscador", () => {
    expect(leerCodigoCie10("K02.1 — Caries de la dentina")).toBe("K02.1");
    expect(leerCodigoCie10(" k021")).toBe("K02.1");
    expect(leerCodigoCie10("K02")).toBe("K02");
    expect(leerCodigoCie10("caries")).toBe(null);
  });

  it("solo son elegibles los subcódigos y las categorías sin subcódigos", () => {
    expect([...ELEGIBLES].sort()).toEqual(["K02.0", "K02.1", "K99", "S02.5"]);
  });
});

describe("validarDiagnostico", () => {
  it("acepta un diagnóstico por pieza y superficies", () => {
    const r = validarDiagnostico(entrada({ cie10: "K02.1 — Caries de la dentina", tipo: "presuntivo", pieza: "36" },
      { superficies: ["oclusal", "mesial", "oclusal", "inventada"] }), ELEGIBLES);
    expect(r).toEqual({ ok: true, datos: { cie10: "K02.1", tipo: "presuntivo", pieza: 36, superficies: ["oclusal", "mesial"], observacion: null } });
  });

  it("rechaza la categoría con subcódigos y explica cuál elegir", () => {
    const r = validarDiagnostico(entrada({ cie10: "K02", tipo: "definitivo" }), ELEGIBLES);
    expect(r.ok === false && r.errores.cie10).toBe("Elige un subcódigo de K02 (por ejemplo, K02.0), no la categoría.");
  });

  it("exige código, tipo y pieza FDI válida; superficies solo con pieza", () => {
    const r = validarDiagnostico(entrada({ pieza: "19" }, { superficies: ["oclusal"] }), ELEGIBLES);
    expect(r.ok === false && Object.keys(r.errores).sort()).toEqual(["cie10", "pieza", "tipo"]);
    const sinPieza = validarDiagnostico(entrada({ cie10: "K02.1", tipo: "definitivo" }, { superficies: ["oclusal"] }), ELEGIBLES);
    expect(sinPieza.ok === false && sinPieza.errores.superficies).toBe("Indica la pieza de esas superficies.");
  });

  it("rechaza superficies que la pieza no tiene", () => {
    const r = validarDiagnostico(entrada({ cie10: "K02.1", tipo: "definitivo", pieza: "46" }, { superficies: ["palatino", "oclusal"] }), ELEGIBLES);
    expect(r.ok === false && r.errores.superficies).toBe("La pieza 46 no tiene superficie palatino.");
    expect(superficiesImposibles(11, ["oclusal", "incisal", "lingual"])).toEqual(["oclusal", "lingual"]);
    expect(superficiesImposibles(74, ["oclusal", "lingual"])).toEqual([]);
  });

  it("piezas FDI permanentes y temporales", () => {
    expect([11, 18, 48, 51, 85].every(esPiezaFdi)).toBe(true);
    expect([10, 19, 49, 56, 86, 91].some(esPiezaFdi)).toBe(false);
  });
});

describe("validarExamen", () => {
  it("exige al menos un dato y valida la higiene", () => {
    expect(validarExamen(() => "").ok).toBe(false);
    const mala = validarExamen((c) => (c === "higiene" ? "excelente" : ""));
    expect(mala.ok === false && mala.errores.higiene).toBe("Elige buena, regular o mala.");
    const ok = validarExamen((c) => ({ atm: " Sin alteraciones ", higiene: "regular" } as Record<string, string>)[c] ?? "");
    expect(ok.ok && ok.datos).toMatchObject({ atm: "Sin alteraciones", higiene: "regular", encia: null });
  });
});

describe("validarDiagnosticos (varios a la vez, Etapa 21)", () => {
  const elegibles = new Set(["K02.1", "K05.1", "K04.0"]);
  const e = (v: { cie10: string[]; pieza?: string; tipo?: string; superficies?: string[] }) => ({
    texto: (c: string) => (c === "pieza" ? v.pieza ?? "" : c === "tipo" ? v.tipo ?? "definitivo" : ""),
    lista: (c: string) => (c === "cie10" ? v.cie10 : c === "superficies" ? v.superficies ?? [] : []),
  });
  it("un diagnóstico por código y por pieza", () => {
    const r = validarDiagnosticos(e({ cie10: ["K02.1 — Caries de la dentina", "K04.0"], pieza: "16, 26" }), elegibles);
    expect(r.ok && r.datos.map((d) => `${d.cie10}/${d.pieza}`)).toEqual(["K02.1/16", "K02.1/26", "K04.0/16", "K04.0/26"]);
  });
  it("sin piezas, uno por código; repetidos se cuentan una vez", () => {
    const r = validarDiagnosticos(e({ cie10: ["K05.1", "K05.1", "K02.1"] }), elegibles);
    expect(r.ok && r.datos.map((d) => d.cie10)).toEqual(["K05.1", "K02.1"]);
  });
  it("avisa qué código no vale y no deja superficies con varias piezas", () => {
    const malo = validarDiagnosticos(e({ cie10: ["K02.1", "Z99.9"] }), elegibles);
    expect(!malo.ok && malo.errores.cie10).toMatch(/^Z99\.9: /);
    const sup = validarDiagnosticos(e({ cie10: ["K02.1"], pieza: "16 26", superficies: ["oclusal"] }), elegibles);
    expect(!sup.ok && sup.errores.superficies).toMatch(/varias piezas/);
  });
  it("sin código pide elegir uno", () => {
    const r = validarDiagnosticos(e({ cie10: [] }), elegibles);
    expect(!r.ok && r.errores.cie10).toBe("Busca y elige el código CIE-10.");
  });
});
