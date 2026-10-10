import { expect, test } from "@playwright/test";
import { conEtapa5, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

// Etapa 13: registro más ágil sin perder rigor (un ítem por pieza).
test.skip(!conSupabaseLocal || !conEtapa5, "Crea datos: solo contra Supabase local con la Etapa 5 encendida");

test("la odontóloga agrega la misma restauración a tres piezas en un solo paso", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Rosa");
  await page.getByLabel("Apellidos").fill(`Agil${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1988-03-03");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("944111333");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  const pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";

  await page.goto(`/pacientes/${pacienteId}/plan`);
  await page.getByLabel("Título del plan").fill("Restauraciones");
  await page.getByLabel("Primera fase").fill("Operatoria");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await page.locator("#i-procedimiento").selectOption({ label: "OPE-01 · Restauración con resina compuesta" });
  await page.locator("#i-pieza").fill("16, 26 99");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText("Pieza 99: pieza FDI de dos dígitos: 11–48 o 51–85.")).toBeVisible();
  await expect(page.locator("li[data-item]")).toHaveCount(0);

  await page.locator("#i-pieza").fill("16, 26, 36");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText("Agregados 3 ítems: Restauración con resina compuesta en las piezas 16, 26, 36.")).toBeVisible();
  const items = page.locator("li[data-item]").filter({ hasText: "Restauración con resina compuesta" });
  await expect(items).toHaveCount(3);
  for (const p of ["16", "26", "36"]) await expect(items.filter({ hasText: `pieza ${p}` })).toHaveCount(1);
});
