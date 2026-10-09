import { expect, test, type Page } from "@playwright/test";
import { conEtapa4, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa4, "Crea datos: solo contra Supabase local con la Etapa 4 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";

async function crearPaciente(page: Page) {
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Jorge");
  await page.getByLabel("Apellidos").fill(`Examen${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1980-02-10");
  await page.getByLabel("Sexo").selectOption("masculino");
  await page.locator("#campo-telefono").fill("944333222");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  expect(pacienteId).toMatch(/^[0-9a-f-]{36}$/);
}

const diagnostico = (page: Page, codigo: string) =>
  page.locator("li[data-diagnostico]").filter({ hasText: codigo });

test("la odontóloga registra el examen y un diagnóstico, lo confirma y le agrega una adenda", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await crearPaciente(page);
  await page.getByRole("navigation", { name: "Secciones del paciente" })
    .getByRole("link", { name: "Examen y diagnóstico" }).click();
  await expect(page.getByText("Aún no tiene diagnósticos registrados.")).toBeVisible();

  // Examen: sin datos no se guarda; con datos sí
  await page.getByRole("button", { name: "Registrar examen" }).click();
  await expect(page.getByText("Registra al menos un dato del examen.")).toBeVisible();
  await page.locator("#x-atm").fill("Sin alteraciones");
  await page.locator("#x-encia").fill("Inflamada en el sector anteroinferior");
  await page.getByRole("radio", { name: "Regular" }).check();
  await page.getByRole("button", { name: "Registrar examen" }).click();
  await expect(page.getByText("Examen clínico registrado.")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Inflamada en el sector anteroinferior" })).toContainText("Regular");

  // Diagnóstico: la categoría no basta; el subcódigo sí
  await page.locator("#d-cie10").fill("K02");
  await page.getByRole("radio", { name: "Presuntivo" }).check();
  await page.locator("#d-pieza").fill("36");
  await page.getByRole("checkbox", { name: "Oclusal" }).check();
  await page.getByRole("button", { name: "Registrar diagnóstico" }).click();
  await expect(page.getByText(/Elige un subcódigo de K02/)).toBeVisible();
  await expect(page.locator("#d-pieza")).toHaveValue("36");
  await page.locator("#d-cie10").fill("K02.1 — Caries de la dentina");
  await page.getByRole("button", { name: "Registrar diagnóstico" }).click();
  await expect(page.getByText("Diagnóstico K02.1 registrado.")).toBeVisible();
  const presuntivo = diagnostico(page, "K02.1");
  await expect(presuntivo).toContainText("Caries de la dentina");
  await expect(presuntivo).toContainText("pieza 36 (oclusal)");
  await expect(presuntivo).toContainText("Presuntivo");
  await expect(presuntivo).toContainText("COP");

  // Adenda (el diagnóstico no se edita)
  await presuntivo.getByText("Agregar adenda").click();
  await presuntivo.getByLabel("Texto de la adenda").fill("Radiografía: compromiso dentinario sin afectación pulpar");
  await presuntivo.getByRole("button", { name: "Guardar adenda" }).click();
  await expect(presuntivo).toContainText("Radiografía: compromiso dentinario sin afectación pulpar");

  // Confirmar como definitivo: el formulario llega lleno
  await presuntivo.getByRole("link", { name: "Confirmar como definitivo" }).click();
  await expect(page.getByRole("heading", { name: "Confirmar diagnóstico" })).toBeVisible();
  await expect(page.locator("#d-pieza")).toHaveValue("36");
  await page.getByRole("button", { name: "Confirmar diagnóstico" }).click();
  await expect(page.getByText("Diagnóstico K02.1 registrado.")).toBeVisible();
  await expect(diagnostico(page, "K02.1").filter({ hasText: "Definitivo" })).toBeVisible();
  await expect(diagnostico(page, "K02.1").filter({ hasText: "Presuntivo · confirmado" })).toBeVisible();

  // Un diagnóstico general y su anulación con motivo
  await page.goto(`/pacientes/${pacienteId}/examen`);
  await page.locator("#d-cie10").fill("K05.1");
  await page.getByRole("radio", { name: "Definitivo" }).check();
  await page.getByRole("button", { name: "Registrar diagnóstico" }).click();
  await expect(page.getByText("Diagnóstico K05.1 registrado.")).toBeVisible();
  const gingivitis = diagnostico(page, "K05.1");
  await gingivitis.getByText("Anular", { exact: true }).click();
  await gingivitis.getByPlaceholder(/Motivo/).fill("Registrado por error");
  await gingivitis.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(diagnostico(page, "K05.1")).toContainText("Anulado: Registrado por error");
});

test("la asistente ve el examen y los diagnósticos, pero no los registra", async ({ page }) => {
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/examen`);
  await expect(diagnostico(page, "K02.1").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nuevo diagnóstico" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Registrar examen clínico" })).toHaveCount(0);
  await expect(page.getByText("Agregar adenda")).toHaveCount(0);
});

test("recepción no ve la pestaña ni la página", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}`);
  await expect(page.getByRole("link", { name: "Examen y diagnóstico" })).toHaveCount(0);
  await page.goto(`/pacientes/${pacienteId}/examen`);
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteId}$`));
});
