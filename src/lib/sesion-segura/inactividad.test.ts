import { describe, expect, it } from "vitest";
import { estadoInactividad, minutosValidos } from "./inactividad";

const MIN = 60_000;

describe("estadoInactividad", () => {
  it("está activa mientras falta más de un minuto", () => {
    expect(estadoInactividad(0, 13 * MIN, 15)).toEqual({ tipo: "activa" });
  });

  it("avisa en el último minuto con los segundos restantes", () => {
    expect(estadoInactividad(0, 14 * MIN, 15)).toEqual({ tipo: "aviso", segundosRestantes: 60 });
    expect(estadoInactividad(0, 15 * MIN - 1500, 15)).toEqual({ tipo: "aviso", segundosRestantes: 2 });
  });

  it("expira al cumplirse el límite", () => {
    expect(estadoInactividad(0, 15 * MIN, 15)).toEqual({ tipo: "expirada" });
    expect(estadoInactividad(0, 99 * MIN, 15)).toEqual({ tipo: "expirada" });
  });

  it("una actividad futura (relojes desfasados entre pestañas) cuenta como recién activa", () => {
    expect(estadoInactividad(10 * MIN, 5 * MIN, 15)).toEqual({ tipo: "activa" });
  });
});

describe("minutosValidos", () => {
  it("acepta enteros de 5 a 120", () => {
    expect(minutosValidos("15")).toBe(15);
    expect(minutosValidos(5)).toBe(5);
    expect(minutosValidos(120)).toBe(120);
  });

  it("rechaza fuera de rango, decimales y texto", () => {
    for (const v of [4, 121, 7.5, "abc", "", null]) expect(minutosValidos(v), String(v)).toBeNull();
  });
});
