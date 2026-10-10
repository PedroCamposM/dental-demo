import { describe, expect, it } from "vitest";
import { comparar, nic, piezaVacia, resumen, tieneFurca, validarPiezas, type PiezaPeriodonto } from "./periodonto";

const pieza = (n: number, extra: Partial<PiezaPeriodonto> = {}): PiezaPeriodonto => ({ ...piezaVacia(n), ...extra });

describe("validarPiezas", () => {
  it("acepta mediciones válidas y conserva las piezas vaciadas (para borrar lo guardado)", () => {
    const r = validarPiezas(JSON.stringify([
      { pieza: 16, ps: [3, 2, 5, "4", null, ""], mg: [1, 0, 2, 0, 0, -1], movilidad: 1, furca: 2, sangrado: [false, false, true, false, false, false] },
      { pieza: 15 },
      { pieza: 18, ausente: true },
    ]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.piezas.map((p) => p.pieza)).toEqual([16, 15, 18]);
    expect(r.piezas[0]?.ps).toEqual([3, 2, 5, 4, null, null]);
    expect(r.piezas[0]?.furca).toBe(2);
  });
  it("rechaza datos fuera de rango, decimales, piezas temporales y duplicadas", () => {
    expect(validarPiezas(JSON.stringify([{ pieza: 16, ps: [3, 2, 25, 4, 2, 3] }]))).toMatchObject({ ok: false, error: expect.stringContaining("entre 0 y 20") });
    expect(validarPiezas(JSON.stringify([{ pieza: 16, ps: [3, 2, 2.5, 4, 2, 3] }]))).toMatchObject({ ok: false, error: expect.stringContaining("enteros") });
    expect(validarPiezas(JSON.stringify([{ pieza: 16, ps: [3, 2] }]))).toMatchObject({ ok: false, error: expect.stringContaining("seis sitios") });
    expect(validarPiezas(JSON.stringify([{ pieza: 55 }])).ok).toBe(false);
    expect(validarPiezas(JSON.stringify([{ pieza: 16 }, { pieza: 16 }])).ok).toBe(false);
    expect(validarPiezas(JSON.stringify([{ pieza: 16, movilidad: 4 }])).ok).toBe(false);
    expect(validarPiezas("no es json").ok).toBe(false);
  });
  it("una pieza ausente no lleva mediciones", () => {
    expect(validarPiezas(JSON.stringify([{ pieza: 16, ausente: true, ps: [3, 3, 3, 3, 3, 3] }])).ok).toBe(false);
  });
  it("no guarda furca en piezas sin furca", () => {
    const r = validarPiezas(JSON.stringify([{ pieza: 11, furca: 2, movilidad: 1 }]));
    expect(r.ok && r.piezas[0]?.furca).toBeNull();
    expect(tieneFurca(46) && tieneFurca(14) && !tieneFurca(34) && !tieneFurca(11)).toBe(true);
  });
});

describe("resumen y comparación", () => {
  it("NIC = PS + MG", () => {
    expect(nic(5, 2)).toBe(7);
    expect(nic(3, -1)).toBe(2);
    expect(nic(3, null)).toBeNull();
  });
  it("cuenta sitios, sangrado, placa y bolsas", () => {
    const r = resumen([
      pieza(16, { ps: [3, 4, 6, 2, null, null], mg: [0, 0, 1, 0, null, null], sangrado: [false, true, true, false, false, false],
        placa: [true, false, false, false, false, false] }),
      pieza(18, { ausente: true }),
    ]);
    expect(r).toEqual({ piezasPresentes: 1, sitios: 4, sangrado: 50, placa: 17, ps4: 2, ps6: 1, nicMedio: 4 });
  });
  it("marca los sitios que cambian 2 mm o más entre fechas", () => {
    const antes = [pieza(16, { ps: [3, 3, 3, 3, 3, 3], mg: [0, 0, 0, 0, 0, 0] })];
    const despues = [pieza(16, { ps: [3, 5, 3, 3, 2, 3], mg: [0, 1, 0, 0, 0, 0] })];
    expect(comparar(antes, despues)).toEqual([{ pieza: 16, sitio: "V", antes: 3, despues: 6, diferencia: 3 }]);
    // Sin MG en una de las fechas se compara PS con PS (no NIC con PS)
    // V: NIC 6 antes; después solo PS 4 → PS 5 vs 4 (1 mm), no NIC 6 vs PS 4
    const sinMg = [pieza(16, { ps: [3, 4, 3, 3, 2, 3] })];
    expect(comparar(despues, sinMg)).toEqual([]);
  });
});
