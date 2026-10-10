import { describe, expect, it } from "vitest";
import {
  ALTO_TOTAL, ANCHO_TOTAL, centroX, corona, fila, grupo, raices, TODAS_LAS_PIEZAS, zonaDeSuperficie,
} from "./geometria";

describe("odontograma: disposición del gráfico único (NTS 188, Anexo)", () => {
  it("tiene las 52 piezas FDI en cuatro filas", () => {
    expect(TODAS_LAS_PIEZAS).toHaveLength(52);
    expect(new Set(TODAS_LAS_PIEZAS).size).toBe(52);
  });

  it("la derecha del paciente queda a la izquierda del gráfico y la 51 bajo la 11", () => {
    expect(centroX(18)).toBeLessThan(centroX(11));
    expect(centroX(11)).toBeLessThan(centroX(21));
    expect(centroX(51)).toBe(centroX(11));
    expect(centroX(85)).toBe(centroX(45));
    expect(centroX(38)).toBeGreaterThan(centroX(31));
    expect(Math.min(...TODAS_LAS_PIEZAS.map(centroX))).toBeGreaterThan(0);
    expect(Math.max(...TODAS_LAS_PIEZAS.map(centroX))).toBeLessThan(ANCHO_TOTAL);
  });

  it("filas de arriba abajo: permanentes sup., temporales sup., temporales inf., permanentes inf.", () => {
    const y = [16, 54, 84, 46].map((p) => corona(p).y);
    expect([...y].sort((a, b) => a - b)).toEqual(y);
    expect(fila(46).recuadroY).toBeLessThan(ALTO_TOTAL);
    // Superiores: recuadro encima del número; inferiores: debajo
    expect(fila(16).recuadroY).toBeLessThan(fila(16).numeroY);
    expect(fila(46).recuadroY).toBeGreaterThan(fila(46).numeroY);
  });

  it("raíces: 3 en molares superiores, 2 en inferiores, 1 en el resto y discontinua en 14 y 24", () => {
    expect(raices(16).cantidad).toBe(3);
    expect(raices(55).cantidad).toBe(3);
    expect(raices(46).cantidad).toBe(2);
    expect(raices(75).cantidad).toBe(2);
    expect(raices(14)).toEqual({ cantidad: 1, discontinua: true });
    expect(raices(34)).toEqual({ cantidad: 1, discontinua: false });
    expect([grupo(53), grupo(15), grupo(11)]).toEqual(["anterior", "premolar", "anterior"]);
  });
});

describe("superficies (convención por confirmar con la clínica)", () => {
  it("vestibular hacia la raíz; palatino/lingual hacia el centro; mesial hacia la línea media", () => {
    expect(zonaDeSuperficie(16, "vestibular")).toBe("arriba");
    expect(zonaDeSuperficie(16, "palatino")).toBe("abajo");
    expect(zonaDeSuperficie(46, "vestibular")).toBe("abajo");
    expect(zonaDeSuperficie(46, "lingual")).toBe("arriba");
    expect(zonaDeSuperficie(16, "mesial")).toBe("derecha");
    expect(zonaDeSuperficie(26, "mesial")).toBe("izquierda");
    expect(zonaDeSuperficie(36, "distal")).toBe("derecha");
    expect(zonaDeSuperficie(11, "incisal")).toBe("centro");
  });
});
