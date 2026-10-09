import { describe, expect, it } from "vitest";
import { totales, validarItem, type ProcedimientoCatalogo } from "./plan";

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
