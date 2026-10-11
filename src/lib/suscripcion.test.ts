import { describe, expect, it } from "vitest";
import { ahorroAnual, leerPrecio, rangoOdontologos, tarifaSugerida, tipoConstancia, validarReporte, type Tarifa } from "./suscripcion";

const TARIFAS: Tarifa[] = [
  { codigo: "consultorio", nombre: "Consultorio", max_odontologos: 2, mensual_centimos: 9900, anual_centimos: 99000 },
  { codigo: "clinica", nombre: "Clínica", max_odontologos: 5, mensual_centimos: 17900, anual_centimos: 179000 },
  { codigo: "clinica_plus", nombre: "Clínica+", max_odontologos: null, mensual_centimos: 29900, anual_centimos: 299000 },
];

describe("tarifas", () => {
  it("sugiere el plan más chico que cubre a los odontólogos activos", () => {
    expect(tarifaSugerida(0, TARIFAS)?.codigo).toBe("consultorio");
    expect(tarifaSugerida(2, TARIFAS)?.codigo).toBe("consultorio");
    expect(tarifaSugerida(3, TARIFAS)?.codigo).toBe("clinica");
    expect(tarifaSugerida(12, TARIFAS)?.codigo).toBe("clinica_plus");
  });
  it("el anual ahorra dos meses y el rango se lee claro", () => {
    expect(ahorroAnual(TARIFAS[0]!)).toBe(19800);
    expect(TARIFAS.map((t) => rangoOdontologos(t, TARIFAS))).toEqual(["1 a 2 odontólogos", "3 a 5 odontólogos", "6 o más odontólogos"]);
  });
  it("lee precios en soles", () => {
    expect(leerPrecio("99")).toBe(9900);
    expect(leerPrecio("1,790.50")).toBe(179050);
    expect(leerPrecio("0")).toBeNull();
    expect(leerPrecio("abc")).toBeNull();
  });
});

describe("validarReporte", () => {
  const hoy = "2026-10-11";
  const base = { tarifa: "consultorio", periodo: "mensual", metodo: "yape", operacion: " 123456 ", pagado_el: "2026-10-10" };
  const t = (v: Record<string, string>) => (c: string) => v[c] ?? "";
  const codigos = TARIFAS.map((x) => x.codigo);
  it("arma los datos", () => {
    expect(validarReporte(t(base), codigos, hoy)).toEqual({ ok: true, datos: { ...base, operacion: "123456" } });
  });
  it("exige plan, periodo, método, operación y fecha de los últimos 60 días", () => {
    const r = validarReporte(t({}), codigos, hoy);
    expect(r.ok === false && Object.keys(r.errores).sort()).toEqual(["metodo", "operacion", "pagado_el", "periodo", "tarifa"]);
    const futura = validarReporte(t({ ...base, pagado_el: "2026-10-12" }), codigos, hoy);
    expect(futura.ok).toBe(false);
    const vieja = validarReporte(t({ ...base, pagado_el: "2026-08-01" }), codigos, hoy);
    expect(vieja.ok).toBe(false);
  });
});

describe("tipoConstancia", () => {
  it("acepta imágenes y PDF por su firma", () => {
    expect(tipoConstancia(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))?.mime).toBe("application/pdf");
    expect(tipoConstancia(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(tipoConstancia(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
  });
});
