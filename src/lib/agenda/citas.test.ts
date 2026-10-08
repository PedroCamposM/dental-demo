import { describe, expect, it } from "vitest";
import { dentroDeHorario, validarCita } from "./citas";

const P = "11111111-1111-4111-8111-111111111111";
const D = "22222222-2222-4222-8222-222222222222";
const AHORA = new Date("2026-10-08T15:00:00Z");   // 10:00 en Lima

describe("validarCita", () => {
  it("calcula inicio y fin en hora de Lima", () => {
    const r = validarCita({ paciente_id: P, profesional_id: D, fecha: "2026-10-12", hora: "09:30", duracion: "45",
      nota: "  Control  de brackets " }, AHORA);
    expect(r).toEqual({
      ok: true,
      datos: {
        paciente_id: P, odontologo_id: D, inicio: "2026-10-12T14:30:00.000Z", fin: "2026-10-12T15:15:00.000Z",
        nota: "Control de brackets", forzada_motivo: null,
      },
    });
  });

  it("rechaza datos incompletos, horas pasadas y citas que cruzan la medianoche", () => {
    const vacia = validarCita({}, AHORA);
    expect(vacia.ok === false && Object.keys(vacia.errores).sort())
      .toEqual(["duracion", "fecha", "hora", "paciente_id", "profesional_id"]);
    const pasada = validarCita({ paciente_id: P, profesional_id: D, fecha: "2026-10-08", hora: "08:00", duracion: "30" }, AHORA);
    expect(pasada.ok === false && pasada.errores.hora).toBe("Esa hora ya pasó.");
    const noche = validarCita({ paciente_id: P, profesional_id: D, fecha: "2026-10-12", hora: "23:45", duracion: "30" }, AHORA);
    expect(noche.ok === false && noche.errores.duracion).toBe("La cita debe terminar el mismo día.");
    const media = validarCita({ paciente_id: P, profesional_id: D, fecha: "2026-10-12", hora: "23:30", duracion: "30" }, AHORA);
    expect(media.ok === false && media.errores.duracion).toBe("La cita debe terminar el mismo día.");
    const imposible = validarCita({ paciente_id: P, profesional_id: D, fecha: "2026-02-30", hora: "10:00", duracion: "30" }, AHORA);
    expect(imposible.ok === false && imposible.errores.fecha).toBe("Fecha inválida.");
    const rara = validarCita({ paciente_id: P, profesional_id: D, fecha: "2026-10-12", hora: "09:32", duracion: "7" }, AHORA);
    expect(rara.ok === false && Object.keys(rara.errores).sort()).toEqual(["duracion", "hora"]);
  });

  it("conserva el motivo para forzar (lo valida la base) y exige que sea claro", () => {
    const r = validarCita({ paciente_id: P, profesional_id: D, fecha: "2026-10-12", hora: "20:00", duracion: "30",
      forzada_motivo: "Urgencia" }, AHORA);
    expect(r.ok && r.datos.forzada_motivo).toBe("Urgencia");
    const corto = validarCita({ paciente_id: P, profesional_id: D, fecha: "2026-10-12", hora: "20:00", duracion: "30",
      forzada_motivo: "x" }, AHORA);
    expect(corto.ok).toBe(false);
  });
});

describe("dentroDeHorario", () => {
  it("compara contra el horario del día", () => {
    expect(dentroDeHorario("09:00", "09:30", "09:00", "13:00")).toBe(true);
    expect(dentroDeHorario("12:45", "13:15", "09:00", "13:00")).toBe(false);
    expect(dentroDeHorario("08:55", "09:30", "09:00", "13:00")).toBe(false);
  });
});
