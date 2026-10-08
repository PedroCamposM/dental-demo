import { describe, expect, it } from "vitest";
import { describirAlertas, imc, leerAlergias, validarCuestionario, validarSignos } from "./cuestionario";

const entrada = (textos: Record<string, string>, listas: Record<string, string[]> = {}) => ({
  texto: (c: string) => textos[c] ?? "",
  lista: (c: string) => listas[c] ?? [],
});

describe("validarCuestionario", () => {
  it("normaliza y filtra opciones desconocidas", () => {
    const r = validarCuestionario(entrada(
      { motivo_consulta: " Dolor en molar ", alergias: "Penicilina, látex\npenicilina\n\n", anticoagulado: "1",
        anticoagulante: "Warfarina", embarazo: "si", semanas_gestacion: "20", lactancia: "1" },
      { enfermedades: ["hipertension", "inventada"], habitos: ["bruxismo"] },
    ), true);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos).toMatchObject({
      motivo_consulta: "Dolor en molar", alergias: ["Penicilina", "látex"], anticoagulado: true,
      anticoagulante: "Warfarina", enfermedades: ["hipertension"], habitos: ["bruxismo"], embarazo: "si",
      semanas_gestacion: 20, lactancia: true, cirugias: null,
    });
  });

  it("exige motivo y el anticoagulante si está anticoagulado", () => {
    const r = validarCuestionario(entrada({ motivo_consulta: "", anticoagulado: "1" }), true);
    expect(r.ok === false && Object.keys(r.errores).sort()).toEqual(["anticoagulante", "motivo_consulta"]);
  });

  it("si el paciente no puede gestar, el embarazo no aplica", () => {
    const r = validarCuestionario(entrada({ motivo_consulta: "Control", embarazo: "si", lactancia: "1" }), false);
    expect(r.ok && r.datos).toMatchObject({ embarazo: "no_aplica", semanas_gestacion: null, lactancia: false });
  });

  it("rechaza semanas fuera de rango", () => {
    const r = validarCuestionario(entrada({ motivo_consulta: "Control", embarazo: "si", semanas_gestacion: "50" }), true);
    expect(r.ok === false && r.errores.semanas_gestacion).toBe("Entre 1 y 42 semanas.");
  });

  it("lee alergias separadas por comas, punto y coma o líneas", () => {
    expect(leerAlergias("AINES; Penicilina\n  aines ")).toEqual(["AINES", "Penicilina"]);
  });
});

describe("validarSignos", () => {
  const signos = (v: Record<string, string>) => (c: string) => v[c] ?? "";

  it("acepta coma decimal y deja vacíos como no registrados", () => {
    const r = validarSignos(signos({ presion_sistolica: "120", presion_diastolica: "80", temperatura_c: "36,6", peso_kg: "64.5" }));
    expect(r).toEqual({
      ok: true,
      datos: { presion_sistolica: 120, presion_diastolica: 80, frecuencia_cardiaca: null, frecuencia_respiratoria: null,
        temperatura_c: 36.6, peso_kg: 64.5, talla_cm: null },
    });
  });

  it("rechaza rangos, presión incompleta o invertida y formularios vacíos", () => {
    const fuera = validarSignos(signos({ temperatura_c: "45", frecuencia_cardiaca: "72.5" }));
    expect(fuera.ok === false && Object.keys(fuera.errores).sort()).toEqual(["frecuencia_cardiaca", "temperatura_c"]);
    const incompleta = validarSignos(signos({ presion_sistolica: "120" }));
    expect(incompleta.ok === false && incompleta.errores.presion_sistolica).toMatch(/completa/);
    const invertida = validarSignos(signos({ presion_sistolica: "80", presion_diastolica: "120" }));
    expect(invertida.ok === false && invertida.errores.presion_sistolica).toMatch(/mayor/);
    const vacia = validarSignos(signos({}));
    expect(vacia.ok === false && vacia.errores.general).toBe("Registra al menos un signo vital.");
  });

  it("calcula el IMC sin interpretarlo", () => {
    expect(imc(64.5, 158)).toBe(25.8);
    expect(imc(null, 158)).toBeNull();
  });
});

describe("describirAlertas", () => {
  it("solo describe lo registrado", () => {
    expect(describirAlertas({ alergias: ["Penicilina"], anticoagulante: "Warfarina", enfermedades: ["hipertension", "diabetes"],
      embarazo: true, semanas_gestacion: 20 })).toEqual([
      "Alergia: Penicilina", "Anticoagulado: Warfarina", "Hipertensión arterial, Diabetes", "Embarazo (20 semanas)",
    ]);
    expect(describirAlertas({ alergias: [], anticoagulante: null, enfermedades: [], embarazo: false, semanas_gestacion: null }))
      .toEqual([]);
  });
});
