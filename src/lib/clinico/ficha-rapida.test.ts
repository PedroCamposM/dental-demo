import { describe, expect, it } from "vitest";
import { validarAnamnesisRapida } from "./ficha-rapida";

const entrada = (v: Record<string, string>, enfermedades: string[] = []) => ({
  texto: (c: string) => v[c] ?? "",
  lista: (c: string) => (c === "enfermedades" ? enfermedades : []),
});

describe("anamnesis de la ficha rápida (formato de la clínica piloto)", () => {
  it("pide el motivo y que se pregunten las alergias", () => {
    const sin = validarAnamnesisRapida(entrada({ motivo_consulta: "Dolor en 46" }), null, false);
    expect(!sin.ok && sin.errores.alergias).toMatch(/Pregunta por las alergias/);
    const ambas = validarAnamnesisRapida(entrada({ motivo_consulta: "Dolor", alergias: "Penicilina", alergias_ninguna: "1" }), null, false);
    expect(!ambas.ok && ambas.errores.alergias).toMatch(/deja una de las dos/);
    const motivo = validarAnamnesisRapida(entrada({ alergias_ninguna: "1" }), null, false);
    expect(!motivo.ok && motivo.errores.motivo_consulta).toBe("Escribe el motivo de consulta.");
  });

  it("registra lo de la hoja y conserva lo demás de la versión anterior", () => {
    const r = validarAnamnesisRapida(
      entrada({ motivo_consulta: "Control", enfermedad_actual: "Sensibilidad al frío", alergias: "Penicilina, látex",
        enfermedades_otras: "Gastritis", anticoagulado: "1", anticoagulante: "Warfarina" }, ["hipertension"]),
      { cirugias: "Apendicectomía 2010", habitos: ["bruxismo"], antecedentes_odontologicos: "Extracción 36", motivo_consulta: "viejo" },
      false,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos).toMatchObject({
      motivo_consulta: "Control", enfermedad_actual: "Sensibilidad al frío", alergias: ["Penicilina", "látex"],
      enfermedades: ["hipertension"], enfermedades_otras: "Gastritis", anticoagulado: true, anticoagulante: "Warfarina",
      cirugias: "Apendicectomía 2010", habitos: ["bruxismo"], antecedentes_odontologicos: "Extracción 36", embarazo: "no_aplica",
    });
  });

  it("embarazo solo si la paciente puede gestar", () => {
    const r = validarAnamnesisRapida(entrada({ motivo_consulta: "Dolor", alergias_ninguna: "1", embarazo: "si", semanas_gestacion: "12" }), null, true);
    expect(r.ok && r.datos.embarazo).toBe("si");
    expect(r.ok && r.datos.semanas_gestacion).toBe(12);
  });
});
