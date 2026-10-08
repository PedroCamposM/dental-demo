import { describe, expect, it } from "vitest";
import { enlaceWhatsApp, rellenarPlantilla } from "./whatsapp";

describe("rellenarPlantilla", () => {
  it("reemplaza las variables, con o sin espacios", () => {
    expect(rellenarPlantilla("Hola {{nombre}}, debe {{ monto }}.", { nombre: "Ana", monto: "S/ 200.00" }))
      .toBe("Hola Ana, debe S/ 200.00.");
  });

  it("deja a la vista las variables que no conoce", () => {
    expect(rellenarPlantilla("Hola {{nombre}} {{apodo}}", { nombre: "Ana" })).toBe("Hola Ana {{apodo}}");
  });
});

describe("enlaceWhatsApp", () => {
  it("arma el enlace wa.me con el texto codificado", () => {
    expect(enlaceWhatsApp("51987654321", "Hola Ana, ¿le reservamos cita? 10% & más"))
      .toBe("https://wa.me/51987654321?text=Hola%20Ana%2C%20%C2%BFle%20reservamos%20cita%3F%2010%25%20%26%20m%C3%A1s");
  });

  it("acepta el número con + o espacios", () => {
    expect(enlaceWhatsApp("+51 987 654 321", "x")).toBe("https://wa.me/51987654321?text=x");
  });

  it("rechaza números que no son peruanos", () => {
    expect(() => enlaceWhatsApp("987654321", "x")).toThrow();
  });
});
