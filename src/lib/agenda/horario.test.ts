import { describe, expect, it } from "vitest";
import { minutos, validarBloqueo, validarSemana } from "./horario";

const SILLON = "11111111-1111-4111-8111-111111111111";
const lector = (campos: Record<string, string>) => (c: string) => campos[c] ?? "";

describe("validarSemana", () => {
  it("lee los días que atiende y apaga los demás", () => {
    const r = validarSemana(lector({
      activo_1: "1", sillon_1: SILLON, inicio_1: "09:00", fin_1: "13:00",
      activo_3: "1", sillon_3: SILLON, inicio_3: "15:00", fin_3: "20:30",
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dias).toHaveLength(7);
    expect(r.dias[0]).toEqual({ dia: 1, activo: true, sillon_id: SILLON, hora_inicio: "09:00", hora_fin: "13:00" });
    expect(r.dias[1]).toEqual({ dia: 2, activo: false });
  });

  it("explica cada día con errores", () => {
    const r = validarSemana(lector({
      activo_1: "1", sillon_1: "", inicio_1: "09:00", fin_1: "13:00",
      activo_2: "1", sillon_2: SILLON, inicio_2: "13:00", fin_2: "09:00",
      activo_3: "1", sillon_3: SILLON, inicio_3: "09:03", fin_3: "13:00",
      activo_4: "1", sillon_4: SILLON, inicio_4: "", fin_4: "13:00",
    }));
    expect(r).toEqual({
      ok: false,
      errores: {
        1: "Elige el sillón.",
        2: "La hora de fin debe ser posterior a la de inicio.",
        3: "Usa horas en múltiplos de 5 minutos.",
        4: "Indica la hora de inicio y de fin.",
      },
    });
  });

  it("convierte horas a minutos", () => {
    expect(minutos("09:30")).toBe(570);
    expect(minutos("24:00")).toBeNull();
    expect(minutos("9:30")).toBeNull();
  });
});

describe("validarBloqueo", () => {
  const AHORA = new Date("2026-10-08T15:00:00Z");

  it("un día completo en Lima va de 00:00 a 00:00 del día siguiente", () => {
    const r = validarBloqueo({ tipo: "feriado", desde: "2026-12-08", motivo: "Feriado nacional" }, AHORA);
    expect(r).toEqual({
      ok: true,
      datos: {
        tipo: "feriado", profesional_id: null, motivo: "Feriado nacional",
        inicio: "2026-12-08T05:00:00.000Z", fin: "2026-12-09T05:00:00.000Z",
      },
    });
  });

  it("acepta un rango de horas para un profesional", () => {
    const r = validarBloqueo({
      tipo: "capacitacion", profesional_id: SILLON, desde: "2026-10-12", desde_hora: "14:00",
      hasta: "2026-10-12", hasta_hora: "18:00", motivo: "Curso",
    }, AHORA);
    expect(r.ok && r.datos).toMatchObject({ inicio: "2026-10-12T19:00:00.000Z", fin: "2026-10-12T23:00:00.000Z" });
  });

  it("rechaza rangos invertidos, pasados y sin motivo", () => {
    const invertido = validarBloqueo({ tipo: "otro", desde: "2026-10-12", desde_hora: "18:00", hasta: "2026-10-12",
      hasta_hora: "10:00", motivo: "Algo" }, AHORA);
    expect(invertido.ok === false && invertido.errores.hasta).toBe("El fin debe ser posterior al inicio.");
    const pasado = validarBloqueo({ tipo: "otro", desde: "2026-10-01", motivo: "Algo" }, AHORA);
    expect(pasado.ok === false && pasado.errores.hasta).toMatch(/ya terminó/);
    const sinMotivo = validarBloqueo({ tipo: "magia", desde: "", motivo: "" }, AHORA);
    expect(sinMotivo.ok === false && Object.keys(sinMotivo.errores).sort()).toEqual(["desde", "motivo", "tipo"]);
  });
});
