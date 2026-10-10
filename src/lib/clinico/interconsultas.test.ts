import { describe, expect, it } from "vitest";
import { rutaArchivo } from "./archivos";
import { validarInterconsulta, validarRespuesta } from "./interconsultas";

const U = "11111111-1111-4111-8111-111111111111";
const C = "aaaaaaaa-0000-4000-8000-000000000001";
const P = "bbbbbbbb-0000-4000-8000-000000000002";
const de = (v: Record<string, string>) => (c: string) => v[c] ?? "";

describe("validarInterconsulta", () => {
  it("interna: exige al profesional y descarta el destino", () => {
    const r = validarInterconsulta(de({ tipo: "interna", destinatario_id: U, destino: "x", motivo: "Evaluar maloclusión" }));
    expect(r).toEqual({ ok: true, datos: expect.objectContaining({ destinatario_id: U, destino: null }) });
    expect(validarInterconsulta(de({ tipo: "interna", motivo: "Evaluar maloclusión" })).ok).toBe(false);
  });
  it("externa: exige destino y motivo suficiente", () => {
    const r = validarInterconsulta(de({ tipo: "externa", destino: "  Cardiología  ", motivo: "Riesgo quirúrgico previo" }));
    expect(r.ok && r.datos.destino).toBe("Cardiología");
    const mal = validarInterconsulta(de({ tipo: "externa", destino: "", motivo: "corto" }));
    expect(mal.ok).toBe(false);
    if (!mal.ok) {
      expect(mal.errores.destino).toBeDefined();
      expect(mal.errores.motivo).toBeDefined();
    }
  });
});

describe("validarRespuesta", () => {
  const ctx = { clinicaId: C, pacienteId: P };
  it("texto obligatorio; documento opcional y de la ruta del paciente", () => {
    expect(validarRespuesta(de({ respuesta: "" }), ctx).ok).toBe(false);
    expect(validarRespuesta(de({ respuesta: "Riesgo II/IV" }), ctx)).toEqual({ ok: true, datos: expect.objectContaining({ ruta: null }) });
    expect(validarRespuesta(de({ respuesta: "Riesgo II/IV", ruta: rutaArchivo(C, P, U, "application/pdf"),
      mime: "application/pdf", bytes: "100" }), ctx).ok).toBe(true);
    expect(validarRespuesta(de({ respuesta: "Riesgo II/IV", ruta: rutaArchivo(C, C, U, "application/pdf"),
      mime: "application/pdf", bytes: "100" }), ctx).ok).toBe(false);
  });
});
