import { expect, test, type Page } from "@playwright/test";
import { conEtapa4, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa4, "Crea datos: solo contra Supabase local con la Etapa 4 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";

async function crearPaciente(page: Page) {
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Elena");
  await page.getByLabel("Apellidos").fill(`Odontograma${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1975-07-15");
  await page.getByLabel("Sexo").selectOption("femenino");
  await page.locator("#campo-telefono").fill("944555666");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  expect(pacienteId).toMatch(/^[0-9a-f-]{36}$/);
}

test("la odontóloga crea el odontograma inicial, registra hallazgos y pasa uno a diagnóstico", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await crearPaciente(page);
  await page.getByRole("navigation", { name: "Secciones del paciente" }).getByRole("link", { name: "Odontograma", exact: true }).click();

  // Primer odontograma: inicial, dentición según la edad
  await expect(page.getByRole("heading", { name: "Nuevo odontograma" })).toBeVisible();
  await expect(page.locator("#o-tipo")).toHaveValue("inicial");
  await expect(page.locator("#o-denticion")).toHaveValue("permanente");
  await page.getByRole("button", { name: "Crear odontograma" }).click();
  await expect(page.getByRole("heading", { name: /^Odontograma inicial/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Odontograma inicial/ })).toBeVisible();

  // Tocar la pieza 36 en el gráfico y registrar una caries oclusal
  await page.getByRole("link", { name: "Elegir la pieza 36" }).click();
  await expect(page.getByRole("heading", { name: "Agregar hallazgo en la pieza 36" })).toBeVisible();
  await page.locator("#h-codigo").selectOption("caries");
  await expect(page.locator("#h-pieza")).toHaveValue("36");
  await page.getByRole("button", { name: "Agregar hallazgo" }).click();
  await expect(page.getByText("Marca al menos una superficie.")).toBeVisible();
  await page.getByRole("checkbox", { name: "Oclusal" }).check();
  await page.getByRole("radio", { name: /^CD / }).check();
  await page.getByRole("button", { name: "Agregar hallazgo" }).click();
  await expect(page.getByText("Hallazgo registrado: Lesión de caries dental.")).toBeVisible();
  const caries = page.locator("tr[data-hallazgo]").filter({ hasText: "Lesión de caries dental" });
  await expect(caries).toContainText("36 (oclusal)");
  await expect(caries).toContainText("CD");

  // Validación NTS 188: el diastema es entre piezas vecinas
  await page.locator("#h-codigo").selectOption("diastema");
  await page.locator("#h-pieza").fill("11");
  await page.locator("#h-pieza_hasta").fill("13");
  await page.getByRole("button", { name: "Agregar hallazgo" }).click();
  await expect(page.getByText("Las piezas deben ser vecinas.")).toBeVisible();

  // Del hallazgo al diagnóstico
  await caries.getByRole("link", { name: "Registrar diagnóstico" }).click();
  await expect(page.getByText("Desde el hallazgo del odontograma: Lesión de caries dental en la pieza 36.")).toBeVisible();
  await expect(page.locator("#d-pieza")).toHaveValue("36");
  await expect(page.getByRole("checkbox", { name: "Oclusal" })).toBeChecked();
  await page.locator("#d-cie10").fill("K02.1");
  await page.getByRole("radio", { name: "Definitivo" }).check();
  await page.getByRole("button", { name: "Registrar diagnóstico" }).click();
  await expect(page.getByText("Diagnóstico K02.1 registrado.")).toBeVisible();
  await expect(page.locator("li[data-diagnostico]").filter({ hasText: "K02.1" })).toContainText("desde el odontograma");
});

test("un odontograma de evolución parte de los hallazgos vigentes y conserva el anterior", async ({ page }) => {
  expect(pacienteId, "depende de la primera prueba de este archivo").not.toBe("");
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/odontograma`);
  await page.getByRole("link", { name: "Nuevo odontograma" }).click();
  await expect(page.locator("#o-tipo")).toHaveValue("evolucion");
  await expect(page.getByRole("checkbox", { name: /Partir de los hallazgos vigentes/ })).toBeChecked();
  await page.getByRole("button", { name: "Crear odontograma" }).click();
  await expect(page.getByRole("heading", { name: /^Odontograma evolución/ })).toBeVisible();
  await expect(page.locator("tr[data-hallazgo]").filter({ hasText: "Lesión de caries dental" })).toContainText("36 (oclusal)");

  // Anular en el nuevo lo que ya no está; el inicial no cambia
  const caries = page.locator("tr[data-hallazgo]").filter({ hasText: "Lesión de caries dental" });
  await caries.getByText("Anular", { exact: true }).click();
  await caries.getByPlaceholder("Motivo").fill("Restaurada en la sesión de hoy");
  await caries.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.locator("tr[data-hallazgo]").filter({ hasText: "Anulado: Restaurada en la sesión de hoy" })).toBeVisible();
  const historial = page.getByRole("region", { name: "Odontogramas del paciente" });
  await historial.getByRole("link", { name: "Ver" }).click();
  await expect(page.getByRole("heading", { name: /^Odontograma inicial/ })).toBeVisible();
  await expect(page.locator("tr[data-hallazgo]").filter({ hasText: "Lesión de caries dental" })).not.toContainText("Anulado");
});

test("la asistente ve el odontograma pero no lo modifica", async ({ page }) => {
  expect(pacienteId, "depende de la primera prueba de este archivo").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/odontograma`);
  await expect(page.getByRole("img", { name: /Odontograma evolución/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuevo odontograma" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Agregar hallazgo/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Elegir la pieza/ })).toHaveCount(0);
});

test("recepción no ve el odontograma", async ({ page }) => {
  expect(pacienteId, "depende de la primera prueba de este archivo").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/odontograma`);
  await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteId}$`));
});
