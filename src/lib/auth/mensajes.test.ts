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

describe("mensajeErrorRegistro", () => {
  it("traduce los errores conocidos y no muestra detalles técnicos", async () => {
    const { mensajeErrorRegistro } = await import("./registro");
    expect(mensajeErrorRegistro({ code: "user_already_exists", status: 422 })).toMatch(/ya tiene una cuenta/);
    expect(mensajeErrorRegistro({ code: "signup_disabled" })).toMatch(/aún no está abierto/);
    expect(mensajeErrorRegistro({ status: 429 })).toMatch(/Demasiados intentos/);
    expect(mensajeErrorRegistro(null)).toMatch(/No pudimos crear tu cuenta/);
  });
});
