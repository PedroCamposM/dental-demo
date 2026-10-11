import { expect, test } from "@playwright/test";
import { conEtapa20, conSupabaseLocal } from "./ayudantes";
import { registrarCuenta } from "./plataforma";

// Etapa 20: turnos de caja. En una clínica nueva (aislada de las demás pruebas): abrir con
// fondo, cerrar contando el efectivo (con diferencia), abrir otro turno el mismo día y ver que
// el cierre del día exige cerrar antes el turno abierto. Los cobros por turno los prueba
// supabase/tests/turnos_caja.test.sql.
test.skip(!conSupabaseLocal || !conEtapa20, "Crea una clínica: Supabase local y Etapa 20");

test("el cambio de turno: abrir con fondo, cerrar contando y abrir otro", async ({ page }) => {
  const sufijo = `${Date.now()}`;
  await registrarCuenta(page, `turnos-${sufijo}@clinica-nueva.example`, "Prueba2026x", `Consultorio Turnos ${sufijo}`, "9892");
  await page.getByRole("button", { name: "Crear mi clínica" }).click();
  await expect(page).toHaveURL(/\/pacientes/);
  await page.goto("/caja");
  const turnos = page.getByRole("region", { name: "Turnos de caja" });

  // Mañana: fondo S/ 100, se cuentan S/ 95
  const abrir = turnos.getByRole("form", { name: "Abrir turno" });
  await abrir.getByLabel("Fondo inicial en efectivo (S/)").fill("-3");
  await abrir.getByRole("button", { name: "Abrir turno" }).click();
  await expect(abrir.getByRole("alert")).toContainText("Monto inválido");
  await abrir.getByLabel("Fondo inicial en efectivo (S/)").fill("100");
  await abrir.getByRole("button", { name: "Abrir turno" }).click();
  await expect(turnos.locator("p", { hasText: /^Turno abierto por/ })).toContainText("fondo S/ 100.00");

  // Con el turno abierto no se cierra el día
  await page.getByLabel("Efectivo contado (S/)").fill("0");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Cerrar caja del día" }).click();
  await expect(page.getByRole("region", { name: "Resumen del día" }).getByRole("alert")).toContainText("turno de caja abierto");

  const cerrar = turnos.getByRole("form", { name: "Cerrar turno" });
  await cerrar.getByLabel("Efectivo contado en la gaveta (S/)").fill("95");
  await cerrar.getByLabel("Observaciones (opcional)").fill("Faltan 5 soles");
  page.once("dialog", (d) => void d.accept());
  await cerrar.getByRole("button", { name: "Cerrar turno" }).click();
  await expect(turnos.getByRole("listitem").first()).toContainText("diferencia -S/ 5.00");
  await expect(turnos.getByRole("listitem").first()).toContainText("Faltan 5 soles");

  // Tarde: otro turno el mismo día
  await turnos.getByRole("form", { name: "Abrir turno" }).getByLabel("Fondo inicial en efectivo (S/)").fill("95");
  await turnos.getByRole("form", { name: "Abrir turno" }).getByRole("button", { name: "Abrir turno" }).click();
  await expect(turnos.locator("p", { hasText: /^Turno abierto por/ })).toContainText("fondo S/ 95.00");
  const tarde = turnos.getByRole("form", { name: "Cerrar turno" });
  await tarde.getByLabel("Efectivo contado en la gaveta (S/)").fill("95");
  page.once("dialog", (d) => void d.accept());
  await tarde.getByRole("button", { name: "Cerrar turno" }).click();
  await expect(turnos.getByRole("listitem")).toHaveCount(2);
  await expect(turnos.getByRole("listitem").nth(1)).toContainText("diferencia S/ 0.00");
});
