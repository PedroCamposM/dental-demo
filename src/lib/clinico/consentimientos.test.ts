import { describe, expect, it } from "vitest";
import { rutaArchivo } from "./archivos";
import { itemsConConsentimiento, validarGenerar, validarMotivo, validarPlantilla, validarRegistro } from "./consentimientos";

const U = "11111111-1111-4111-8111-111111111111";
const C = "aaaaaaaa-0000-4000-8000-000000000001";
const P = "bbbbbbbb-0000-4000-8000-000000000002";
const de = (v: Record<string, string>) => (c: string) => v[c] ?? "";

describe("validarGenerar", () => {
  it("procedimiento: exige plantilla e ítem", () => {
    expect(validarGenerar(de({ tipo: "procedimiento", plantilla_id: U, item_plan_id: U }), []).ok).toBe(true);
    expect(validarGenerar(de({ tipo: "procedimiento", plantilla_id: U }), []).ok).toBe(false);
    expect(validarGenerar(de({ tipo: "procedimiento", item_plan_id: U }), []).ok).toBe(false);
  });
  it("uso de imagen: al menos un fin válido", () => {
    expect(validarGenerar(de({ tipo: "uso_imagen", plantilla_id: U }), ["academico"]))
      .toEqual({ ok: true, datos: { tipo: "uso_imagen", fines: ["academico"], plantilla_id: U } });
    expect(validarGenerar(de({ tipo: "uso_imagen", plantilla_id: U }), []).ok).toBe(false);
    expect(validarGenerar(de({ tipo: "uso_imagen", plantilla_id: U }), ["publicidad"]).ok).toBe(false);
  });
});

describe("validarRegistro", () => {
  const ctx = { clinicaId: C, pacienteId: P, hoy: "2026-10-09" };
  const base = { decision: "firmado", decidido: "2026-10-09", mime: "application/pdf", bytes: "2000",
    ruta: rutaArchivo(C, P, U, "application/pdf"), nombre: "formato.pdf" };
  it("acepta la firma con su escaneo", () => {
    expect(validarRegistro(de(base), ctx).ok).toBe(true);
    expect(validarRegistro(de({ ...base, decision: "negado" }), ctx).ok).toBe(true);
  });
  it("rechaza decisión, fecha futura y escaneo ajeno", () => {
    expect(validarRegistro(de({ ...base, decision: "tal vez" }), ctx).ok).toBe(false);
    expect(validarRegistro(de({ ...base, decidido: "2026-10-10" }), ctx).ok).toBe(false);
    expect(validarRegistro(de({ ...base, ruta: rutaArchivo(C, C, U, "application/pdf") }), ctx).ok).toBe(false);
  });
});

describe("validarMotivo", () => {
  it("mínimo 3 caracteres y máximo dado", () => {
    expect(validarMotivo(" no ", 10)).toBe("Escribe el motivo.");
    expect(validarMotivo("x".repeat(11), 10)).toMatch(/Máximo/);
    expect(validarMotivo("Cambió de opinión", 300)).toBeNull();
  });
});

describe("validarPlantilla", () => {
  const base = { tipo: "procedimiento", nombre: "  Exodoncia   simple ", descripcion: "Extracción de la pieza.",
    riesgos: "Dolor, sangrado e inflamación.", activa: "1" };
  it("normaliza y valida", () => {
    const r = validarPlantilla(de(base));
    expect(r.ok && r.datos.nombre).toBe("Exodoncia simple");
    expect(r.ok && r.datos.efectos_adversos).toBeNull();
  });
  it("exige descripción y riesgos", () => {
    const r = validarPlantilla(de({ ...base, riesgos: "corto" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.riesgos).toBeDefined();
  });
  it("al marcarla revisada deja de ser de ejemplo", () => {
    const r = validarPlantilla(de({ ...base, es_ejemplo: "1", revisada: "1" }));
    expect(r.ok && r.datos.es_ejemplo).toBe(false);
    const s = validarPlantilla(de({ ...base, es_ejemplo: "1" }));
    expect(s.ok && s.datos.es_ejemplo).toBe(true);
  });
});

describe("itemsConConsentimiento", () => {
  const A = "a", B = "b", C2 = "c";
  it("hereda el consentimiento del ítem de origen con el mismo procedimiento y pieza", () => {
    const items = [
      { id: A, item_origen_id: null, procedimiento_id: "p", pieza: 48 },
      { id: B, item_origen_id: A, procedimiento_id: "p", pieza: 48 },
      { id: C2, item_origen_id: B, procedimiento_id: "p", pieza: 47 },
    ];
    const r = itemsConConsentimiento(items, new Set([A]));
    expect([...r].sort()).toEqual([A, B]);
  });
});
