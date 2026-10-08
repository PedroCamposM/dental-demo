import { describe, expect, it } from "vitest";
import { validarPlantilla, variablesDeEjemplo } from "./plantillas";
import { rellenarPlantilla } from "./whatsapp";

describe("validarPlantilla", () => {
  it("acepta un mensaje con las variables de su tipo", () => {
    expect(validarPlantilla("cuota_vencida", "Hola {{nombre}}, tiene {{cuotas}} por {{ monto }}.")).toEqual([]);
  });

  it("rechaza un mensaje vacío o demasiado largo", () => {
    expect(validarPlantilla("control", "   ")).toEqual(["El mensaje no puede estar vacío."]);
    expect(validarPlantilla("control", "a".repeat(1001))[0]).toMatch(/muy largo \(1001/);
  });

  it("señala variables que no existen para ese tipo", () => {
    expect(validarPlantilla("control", "Hola {{nombre}}, debe {{monto}} {{monto}} {{edad}}")).toEqual([
      "Variables que no existen para este mensaje: {{monto}}, {{edad}}.",
    ]);
  });

  it("señala llaves sin cerrar", () => {
    expect(validarPlantilla("control", "Hola {{nombre")).toEqual(["Hay llaves {{ }} sin cerrar."]);
    expect(validarPlantilla("control", "Hola nombre}}")).toEqual(["Hay llaves {{ }} sin cerrar."]);
  });
});

describe("variablesDeEjemplo", () => {
  it("permite previsualizar la plantilla sin variables sueltas", () => {
    const texto = rellenarPlantilla("Hola {{nombre}}, su cita del {{fecha}}.", variablesDeEjemplo("no_show"));
    expect(texto).toBe("Hola María, su cita del 2 oct 2026.");
  });
});
