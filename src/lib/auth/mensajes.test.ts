import { describe, expect, it } from "vitest";
import { mensajeErrorLogin } from "./mensajes";

describe("mensajeErrorLogin", () => {
  it("traduce los errores conocidos de Supabase Auth", () => {
    expect(mensajeErrorLogin({ code: "invalid_credentials", status: 400 })).toBe(
      "Correo o contraseña incorrectos.",
    );
    expect(mensajeErrorLogin({ status: 429 })).toMatch(/Demasiados intentos/);
  });

  it("da un mensaje genérico ante errores desconocidos o de red", () => {
    expect(mensajeErrorLogin(null)).toMatch(/No pudimos iniciar sesión/);
    expect(mensajeErrorLogin({ code: "otra_cosa" })).toMatch(/No pudimos iniciar sesión/);
  });
});
