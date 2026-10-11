import { expect, test } from "@playwright/test";
import { conEtapa14, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

// Etapa 14: atención rápida de un paciente ocasional, en una sola pantalla.
test.skip(!conSupabaseLocal || !conEtapa14, "Crea datos: solo contra Supabase local con la Etapa 14 encendida");

test("la odontóloga atiende a un paciente ocasional en un solo paso", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Óscar");
  await page.getByLabel("Apellidos").fill(`Ocasional${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1979-11-11");
  await page.getByLabel("Sexo").selectOption("masculino");
  await page.locator("#campo-telefono").fill("944222777");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  const pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";

  await page.getByRole("link", { name: "Atención rápida" }).click();
  await expect(page.getByRole("heading", { name: /^Atención rápida/ })).toBeVisible();
  page.on("dialog", (d) => void d.accept());

  // Lo mínimo de la NTS 139 es obligatorio (validado en el servidor)
  await page.getByRole("button", { name: "Firmar atención" }).click();
  await expect(page.getByText("Escribe el motivo de consulta.")).toBeVisible();
  await expect(page.getByText(/Pregunta por las alergias/)).toBeVisible();
  await expect(page.getByText("Indica al menos un procedimiento realizado.")).toBeVisible();

  await page.getByLabel("Motivo de consulta").fill("Dolor al frío en molar inferior izquierdo");
  await page.getByLabel("Tiempo de enfermedad").fill("1 semana");
  await page.getByLabel("Alergias (separadas por comas)").fill("Penicilina");
  await page.getByRole("radio", { name: "No", exact: true }).first().check();
  await page.getByLabel("Examen (lo encontrado)").fill("Caries oclusal en 36, sin compromiso pulpar.");
  await page.getByLabel("Diagnóstico CIE-10").fill("K02.1");
  await page.getByLabel("Procedimiento 1", { exact: true }).selectOption({ label: "OPE-01 · Restauración con resina compuesta" });
  await page.getByLabel("Piezas del procedimiento 1").fill("36");
  await page.getByLabel("Descripción de lo realizado").fill("Remoción de caries y restauración oclusal con resina en 36.");
  await page.getByRole("button", { name: "Firmar atención" }).click();

  // Queda igual que el flujo completo: plan terminado, evolución firmada y alerta de alergia
  await page.waitForURL(new RegExp(`/pacientes/${pacienteId}/plan\\?p=`));
  await expect(page.getByText(/Atención rápida registrada y firmada/)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Planes del paciente" })).toContainText("Terminado");
  await expect(page.getByRole("note", { name: "Alertas clínicas" })).toContainText("Alergia: Penicilina");
  await page.goto(`/pacientes/${pacienteId}/evolucion`);
  await expect(page.locator("li[id^=evolucion-]").filter({ hasText: "Remoción de caries" }))
    .toContainText("Realizado Restauración con resina compuesta");
});

test("la asistente no ve la atención rápida", async ({ page }) => {
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto("/pacientes");
  await page.getByRole("link").filter({ hasText: /, / }).first().click();
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "Atención rápida" })).toHaveCount(0);
  await page.goto(`${page.url()}/atencion-rapida`);
  await expect(page).not.toHaveURL(/atencion-rapida/);
});
