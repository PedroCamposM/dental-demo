import { describe, expect, it } from "vitest";
import { armarCorreo, fechaCorta } from "./correos";

const base = { nombre: "Dra. Ana", clinica: "Sonrisa <Feliz>", url: "https://dental.example" };

describe("armarCorreo", () => {
  it("vence pronto: dice qué vence, cuándo y dónde pagar", () => {
    const m = armarCorreo("vence_pronto", { ...base, plan: "prueba", fecha: "2026-10-18" });
    expect(m.asunto).toBe("Tu prueba gratuita vence el 18/10/2026");
    expect(m.texto).toContain("https://dental.example/configuracion/plan");
    expect(m.texto).toContain("Hola, Dra. Ana:");
  });
  it("escapa el HTML de los nombres", () => {
    const m = armarCorreo("bienvenida", base);
    expect(m.html).toContain("Sonrisa &lt;Feliz&gt;");
    expect(m.html).not.toContain("<Feliz>");
  });
  it("plan pagado vencido y pago rechazado con su motivo", () => {
    expect(armarCorreo("vencido", { ...base, plan: "activo", fecha: "2026-10-10" }).asunto).toMatch(/^Tu plan venció/);
    expect(armarCorreo("pago_rechazado", { ...base, motivo: "No aparece en la cuenta" }).texto).toContain("Motivo: No aparece en la cuenta");
    expect(fechaCorta("2026-01-05")).toBe("05/01/2026");
  });
});
