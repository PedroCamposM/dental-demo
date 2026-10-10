import { describe, expect, it } from "vitest";
import { diasAtraso, validarEnvio, validarOrden, validarRecepcion } from "./laboratorio";

const de = (v: Record<string, string>) => (c: string) => v[c] ?? "";
const HOY = "2026-10-10";

describe("validarOrden", () => {
  it("exige el tipo de trabajo y guarda el costo en céntimos", () => {
    expect(validarOrden(de({ tipo_trabajo: " Corona metal-cerámica ", color: "A2", costo: "250.50" })))
      .toEqual({ ok: true, datos: { tipo_trabajo: "Corona metal-cerámica", color: "A2", indicaciones: null, costo_centimos: 25050 } });
    expect(validarOrden(de({ tipo_trabajo: "C" })).ok).toBe(false);
    expect(validarOrden(de({ tipo_trabajo: "Corona", costo: "-5" })).ok).toBe(false);
    expect(validarOrden(de({ tipo_trabajo: "Corona", costo: "1.234" })).ok).toBe(false);
  });
});

describe("validarEnvio y validarRecepcion", () => {
  it("fechas coherentes y no futuras", () => {
    expect(validarEnvio(de({ fecha_envio: "2026-10-01", fecha_entrega_prevista: "2026-10-15" }), HOY)).toEqual({ ok: true, envio: "2026-10-01", entrega: "2026-10-15" });
    expect(validarEnvio(de({ fecha_envio: "2026-10-11", fecha_entrega_prevista: "2026-10-15" }), HOY).ok).toBe(false);
    expect(validarEnvio(de({ fecha_envio: "2026-10-05", fecha_entrega_prevista: "2026-10-01" }), HOY).ok).toBe(false);
    expect(validarEnvio(de({ fecha_envio: "2026-02-30", fecha_entrega_prevista: "2026-10-01" }), HOY).ok).toBe(false);
    expect(validarRecepcion(de({ fecha_recepcion: "2026-10-09", costo: "260" }), HOY, "2026-10-01"))
      .toEqual({ ok: true, recepcion: "2026-10-09", costo_centimos: 26000 });
    expect(validarRecepcion(de({ fecha_recepcion: "2026-09-30" }), HOY, "2026-10-01").ok).toBe(false);
    expect(validarRecepcion(de({ fecha_recepcion: "2026-10-11" }), HOY, "2026-10-01").ok).toBe(false);
  });
});

describe("diasAtraso", () => {
  it("solo en laboratorio y con la entrega pasada", () => {
    expect(diasAtraso({ estado: "en_laboratorio", fecha_entrega_prevista: "2026-10-07" }, HOY)).toBe(3);
    expect(diasAtraso({ estado: "en_laboratorio", fecha_entrega_prevista: "2026-10-10" }, HOY)).toBe(0);
    expect(diasAtraso({ estado: "recibida", fecha_entrega_prevista: "2026-10-01" }, HOY)).toBe(0);
    expect(diasAtraso({ estado: "por_enviar", fecha_entrega_prevista: null }, HOY)).toBe(0);
  });
});
