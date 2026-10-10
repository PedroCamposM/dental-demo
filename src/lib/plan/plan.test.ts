import { describe, expect, it } from "vitest";
import { diagnosticoDePieza, totales, validarItem, validarItems, type ProcedimientoCatalogo } from "./plan";

const CATALOGO: ProcedimientoCatalogo[] = [
  { id: "11111111-1111-4111-8111-111111111111", codigo: "END-02", nombre: "Endodoncia multirradicular",
    precio_base_centimos: 75000, duracion_minutos: 90 },
];
const D = "22222222-2222-4222-8222-222222222222";
const I = "33333333-3333-4333-8333-333333333333";
const contexto = { catalogo: CATALOGO, fases: [1, 2], diagnosticos: [D], items: [I] };
const entrada = (t: Record<string, string>, l: Record<string, string[]> = {}) => ({
  texto: (c: string) => t[c] ?? "", lista: (c: string) => l[c] ?? [],
});

describe("validarItem", () => {
  it("toma precio y duración del catálogo si no se ajustan", () => {
    const r = validarItem(entrada({ procedimiento_id: CATALOGO[0]!.id, pieza: "36", fase: "1", diagnostico_id: D }), contexto);
    expect(r).toMatchObject({ ok: true, datos: { precio_centimos: 75000, duracion_minutos: 90, pieza: 36, diagnostico_id: D,
      procedimiento: "Endodoncia multirradicular" } });
  });

  it("el odontólogo ajusta precio y duración", () => {
    const r = validarItem(entrada({ procedimiento_id: CATALOGO[0]!.id, precio: "680.50", duracion_minutos: "120", fase: "2" },
      { requiere: [I] }), contexto);
    expect(r).toMatchObject({ ok: true, datos: { precio_centimos: 68050, duracion_minutos: 120, fase: 2, requiere: [I] } });
  });

  it("rechaza datos inválidos con mensajes claros", () => {
    const r = validarItem(entrada({ procedimiento_id: "x", precio: "-5", duracion_minutos: "2", pieza: "19", fase: "3",
      diagnostico_id: "44444444-4444-4444-8444-444444444444" }, { requiere: ["otro"] }), contexto);
    expect(r.ok === false && Object.keys(r.errores).sort()).toEqual(
      ["diagnostico_id", "duracion_minutos", "fase", "pieza", "precio", "procedimiento_id", "requiere"]);
    const negativo = validarItem(entrada({ procedimiento_id: CATALOGO[0]!.id, precio: "-5", fase: "1" }), contexto);
    expect(negativo.ok === false && negativo.errores.precio).toBe("El precio no puede ser negativo.");
    const texto = validarItem(entrada({ procedimiento_id: CATALOGO[0]!.id, precio: "ciento", fase: "1" }), contexto);
    expect(texto.ok === false && texto.errores.precio).toBe("Escribe el precio en soles, por ejemplo 180 o 180.50.");
    const sup = validarItem(entrada({ procedimiento_id: CATALOGO[0]!.id, pieza: "36", fase: "1" }, { superficies: ["palatino"] }), contexto);
    expect(sup.ok === false && sup.errores.superficies).toBe("La pieza 36 no tiene superficie palatino.");
  });
});

describe("totales", () => {
  it("no cuenta lo cancelado; separa lo realizado y lo pagado", () => {
    expect(totales([
      { estado: "realizado", precio_centimos: 75000, cobrado_centimos: 75000 },
      { estado: "aceptado", precio_centimos: 90000, cobrado_centimos: 30000 },
      { estado: "cancelado", precio_centimos: 50000, cobrado_centimos: 0 },
    ])).toEqual({ total: 165000, realizado: 75000, pagado: 105000, pendientes: 1 });
  });
});

describe("varias piezas a la vez (Etapa 13)", () => {
  const D16 = "55555555-5555-4555-8555-555555555555";
  const D26 = "66666666-6666-4666-8666-666666666666";
  const DX = [
    { id: D, pieza: 36, cie10: "K02.1" }, { id: D16, pieza: 16, cie10: "K02.1" }, { id: D26, pieza: 26, cie10: "K04.0" },
  ];
  const ctx = { ...contexto, diagnosticos: DX };

  it("un ítem por pieza, con el precio del catálogo en cada uno", () => {
    const r = validarItems(entrada({ procedimiento_id: CATALOGO[0]!.id, pieza: "36, 16 26", fase: "1" }), ctx);
    expect(r.ok && r.datos.map((d) => [d.pieza, d.precio_centimos])).toEqual([[36, 75000], [16, 75000], [26, 75000]]);
  });

  it("el diagnóstico elegido se lleva a cada pieza con el mismo CIE-10; si no hay, queda sin diagnóstico", () => {
    const r = validarItems(entrada({ procedimiento_id: CATALOGO[0]!.id, pieza: "36, 16, 26", fase: "1", diagnostico_id: D }), ctx);
    expect(r.ok && r.datos.map((d) => d.diagnostico_id)).toEqual([D, D16, null]);
    expect(diagnosticoDePieza(null, DX, 16)).toBeNull();
    expect(diagnosticoDePieza(D, DX, null)).toBe(D);
  });

  it("dice qué pieza está mal y valida las superficies en cada una", () => {
    const mal = validarItems(entrada({ procedimiento_id: CATALOGO[0]!.id, pieza: "16 99", fase: "1" }), ctx);
    expect(mal).toMatchObject({ ok: false, errores: { pieza: "Pieza 99: pieza FDI de dos dígitos: 11–48 o 51–85." } });
    const sup = validarItems(entrada({ procedimiento_id: CATALOGO[0]!.id, pieza: "16 11", fase: "1" }, { superficies: ["oclusal"] }), ctx);
    expect(sup).toMatchObject({ ok: false, errores: { superficies: "La pieza 11 no tiene superficie oclusal." } });
  });
});
