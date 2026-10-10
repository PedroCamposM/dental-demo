import { describe, expect, it } from "vitest";
import { validarRegistro } from "./especialidades";

const de = (v: Record<string, string>) => (c: string) => v[c] ?? "";

describe("validarRegistro", () => {
  it("endodoncia: conducto obligatorio, longitud con un decimal y al menos un dato", () => {
    expect(validarRegistro("endodoncia", de({ conducto: " MV ", longitud_trabajo_mm: "21,5", lima_maestra: "K 30" })))
      .toEqual({ ok: true, datos: { conducto: "MV", longitud_trabajo_mm: 21.5, referencia: null, lima_maestra: "K 30",
        irrigacion: null, tecnica_obturacion: null, observaciones: null } });
    expect(validarRegistro("endodoncia", de({ lima_maestra: "K 30" })).ok).toBe(false);
    expect(validarRegistro("endodoncia", de({ conducto: "MV", longitud_trabajo_mm: "45" })).ok).toBe(false);
    expect(validarRegistro("endodoncia", de({ conducto: "MV", longitud_trabajo_mm: "21.55" })).ok).toBe(false);
    expect(validarRegistro("endodoncia", de({ conducto: "MV" }))).toMatchObject({ ok: false, error: expect.stringContaining("al menos un dato") });
  });
  it("implante: marca, diámetro y longitud obligatorios; torque entero", () => {
    expect(validarRegistro("implante", de({ marca: "Marca X", diametro_mm: "4.1", longitud_mm: "10", torque_ncm: "35" })))
      .toMatchObject({ ok: true, datos: { diametro_mm: 4.1, longitud_mm: 10, torque_ncm: 35 } });
    expect(validarRegistro("implante", de({ marca: "Marca X", diametro_mm: "4.1" })).ok).toBe(false);
    expect(validarRegistro("implante", de({ marca: "Marca X", diametro_mm: "4.1", longitud_mm: "10", torque_ncm: "35.5" })).ok).toBe(false);
  });
  it("fase de implante: no se registra la colocación a mano y exige fecha", () => {
    expect(validarRegistro("implante_fase", de({ fase: "carga", fecha: "2026-10-01" }))).toMatchObject({ ok: true });
    expect(validarRegistro("implante_fase", de({ fase: "colocacion", fecha: "2026-10-01" })).ok).toBe(false);
    expect(validarRegistro("implante_fase", de({ fase: "carga" })).ok).toBe(false);
  });
  it("cirugía: el retiro de puntos exige sutura y va de 3 a 30 días", () => {
    expect(validarRegistro("cirugia", de({ tecnica: "Colgajo", sutura: "Seda 3-0", retiro_puntos_dias: "7" })))
      .toMatchObject({ ok: true, datos: { retiro_puntos_dias: 7 } });
    expect(validarRegistro("cirugia", de({ tecnica: "Colgajo", retiro_puntos_dias: "7" })).ok).toBe(false);
    expect(validarRegistro("cirugia", de({ tecnica: "Colgajo", sutura: "Seda", retiro_puntos_dias: "40" })).ok).toBe(false);
  });
  it("odontopediatría: apoderado y conducta", () => {
    expect(validarRegistro("odontopediatria", de({ apoderado_presente: "si", conducta_frankl: "3" })))
      .toMatchObject({ ok: true, datos: { apoderado_presente: true, conducta_frankl: 3 } });
    expect(validarRegistro("odontopediatria", de({ conducta_frankl: "3" })).ok).toBe(false);
    expect(validarRegistro("odontopediatria", de({ apoderado_presente: "no" })).ok).toBe(false);
    expect(validarRegistro("odontopediatria", de({ apoderado_presente: "no", conducta_frankl: "5" })).ok).toBe(false);
  });
  it("ortodoncia: caso con diagnóstico y aparatología; control con algún dato", () => {
    expect(validarRegistro("ortodoncia_caso", de({ diagnostico: "Clase II div. 1", aparatologia: "Brackets metálicos MBT 0.022" })).ok).toBe(true);
    expect(validarRegistro("ortodoncia_caso", de({ diagnostico: "Clase II" })).ok).toBe(false);
    expect(validarRegistro("ortodoncia_control", de({ arco_superior: "NiTi 0.016" })).ok).toBe(true);
    expect(validarRegistro("ortodoncia_control", de({})).ok).toBe(false);
  });
});
