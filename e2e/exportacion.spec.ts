import { expect, test } from "@playwright/test";
import { conEtapa11, conSupabaseLocal, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa11, "Solo contra Supabase local con la Etapa 11 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";
let documento = "";
const MOTIVO = `Solicitud escrita del paciente ${Date.now()}`;

test("la odontóloga exporta la historia clínica completa con motivo", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  // Un paciente de la demo con tratamiento en curso (tiene plan, evoluciones y odontograma)
  await page.goto("/clinico");
  await page.getByRole("region", { name: "Tratamientos en curso" }).getByRole("link").first().click();
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}\/plan/);
  pacienteId = page.url().split("/pacientes/")[1]?.split("/")[0] ?? "";

  await page.goto(`/pacientes/${pacienteId}`);
  await page.getByRole("link", { name: "Exportar historia clínica" }).click();
  await page.getByRole("button", { name: "Exportar historia clínica" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "motivo" })).toBeVisible();
  await page.getByLabel("Motivo de la exportación").fill(MOTIVO);
  await page.getByRole("button", { name: "Exportar historia clínica" }).click();
  await page.waitForURL(new RegExp(`/pacientes/${pacienteId}/exportar/[0-9a-f-]{36}$`));
  documento = page.url();

  await expect(page.getByRole("heading", { name: "Historia clínica odontológica", level: 1 })).toBeVisible();
  await expect(page.getByText(`Motivo: ${MOTIVO}`)).toBeVisible();
  for (const titulo of ["Filiación", "Historia clínica (cuestionario de salud y sus versiones)", "Odontogramas", "Diagnósticos (CIE-10)",
    "Planes de tratamiento", "Evoluciones firmadas", "Consentimientos", "Recetas"]) {
    await expect(page.getByRole("heading", { name: titulo, level: 2 })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Imprimir o guardar como PDF" })).toBeVisible();

  // Queda en la lista de exportaciones con su motivo
  await page.goto(`/pacientes/${pacienteId}/exportar`);
  await expect(page.getByRole("region", { name: "Exportaciones anteriores" })).toContainText(MOTIVO);
});

test("el documento solo lo abre quien lo exportó", async ({ page }) => {
  expect(documento, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "valverde@clinica-demo.example");
  await page.goto(documento);
  await expect(page.getByText("Esta exportación ya no está disponible.")).toBeVisible();
});

test("la asistente no exporta la historia clínica", async ({ page }) => {
  expect(pacienteId, "depende de la primera prueba").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}`);
  await expect(page.getByRole("link", { name: "Exportar historia clínica" })).toHaveCount(0);
  await page.goto(`/pacientes/${pacienteId}/exportar`);
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteId}$`));
});
