import { expect, test, type Page } from "@playwright/test";
import { conEtapa7, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa7, "Crea datos: solo contra Supabase local con la Etapa 7 encendida");
test.describe.configure({ mode: "serial" });

// PNG de 1×1 píxel (ficticio): hace de escaneo del formato firmado
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
let pacienteId = "";

async function crearPacienteConExodoncia(page: Page) {
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Julio");
  await page.getByLabel("Apellidos").fill(`Consentimiento${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1979-02-20");
  await page.getByLabel("Sexo").selectOption("masculino");
  await page.locator("#campo-telefono").fill("944111222");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  expect(pacienteId).toMatch(/^[0-9a-f-]{36}$/);

  await page.goto(`/pacientes/${pacienteId}/plan`);
  await page.getByLabel("Título del plan").fill("Exodoncia de la 48");
  await page.getByLabel("Primera fase").fill("Cirugía");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.getByRole("heading", { name: "Exodoncia de la 48" })).toBeVisible();
  await page.locator("#i-procedimiento").selectOption({ label: "CIR-01 · Exodoncia simple" });
  await page.locator("#i-pieza").fill("48");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText("Agregado: Exodoncia simple.")).toBeVisible();
  await page.getByRole("button", { name: "Registrar aceptación" }).click();
  await expect(page.getByRole("navigation", { name: "Planes del paciente" })).toContainText("Aceptado");
}

test("la odontóloga genera el formato y lo imprime con lo que pide la NTS 139", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await crearPacienteConExodoncia(page);
  await page.goto(`/pacientes/${pacienteId}/consentimientos`);
  await expect(page.getByRole("region", { name: /Requieren consentimiento/ })).toContainText("Exodoncia simple (pieza 48)");
  await expect(page.locator("#g-plantilla")).toHaveValue(/[0-9a-f-]{36}/);   // la del catálogo, preseleccionada
  await page.getByRole("button", { name: "Generar formato" }).click();
  await expect(page.getByText("Formato generado: imprímelo para que lo firmen.")).toBeVisible();
  const item = page.locator("li[data-consentimiento]").filter({ hasText: "Exodoncia simple (pieza 48)" });
  await expect(item).toContainText("Pendiente de firma");

  const enlace = await item.getByRole("link", { name: "Imprimir formato" }).getAttribute("href");
  await page.goto(enlace ?? "");
  await expect(page.getByRole("heading", { name: "Consentimiento informado" })).toBeVisible();
  await expect(page.getByText("PLANTILLA DE EJEMPLO", { exact: false })).toBeVisible();
  for (const texto of ["Riesgos reales y potenciales", "Pronóstico y recomendaciones", "Firma y sello del cirujano dentista",
    "Negativa", "Revocación"]) {
    await expect(page.getByText(texto, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/COP \d+/)).toBeVisible();
  await expect(page.getByText("Huella digital").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimir o guardar como PDF" })).toBeVisible();
});

test("sin el consentimiento firmado, la evolución no puede realizar la exodoncia", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/evolucion`);
  await page.getByRole("button", { name: "Nueva evolución sin cita" }).click();
  const borrador = page.getByRole("article", { name: /Evolución en borrador/ });
  await expect(borrador).toContainText("Falta el consentimiento informado firmado");
  await borrador.getByLabel("Descripción de lo realizado").fill("Exodoncia simple de la 48 sin complicaciones.");
  await borrador.getByRole("checkbox", { name: /^Trabajado: Exodoncia simple/ }).check();
  await borrador.getByRole("checkbox", { name: /^Terminado: Exodoncia simple/ }).check();
  page.once("dialog", (d) => void d.accept());
  await borrador.getByRole("button", { name: "Firmar y cerrar" }).click();
  await expect(borrador.getByRole("alert")).toContainText("requiere el consentimiento informado firmado");
  await expect(borrador.getByRole("alert")).toContainText("Se guardó el borrador");
});

test("la asistente sube el formato firmado a mano", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/consentimientos`);
  await expect(page.getByRole("button", { name: "Generar formato" })).toHaveCount(0);
  const item = page.locator("li[data-consentimiento]").filter({ hasText: "Exodoncia simple (pieza 48)" });
  await item.getByText("Subir formato firmado").click();
  await item.getByLabel(/^Escaneo firmado/).setInputFiles({ name: "consentimiento.png", mimeType: "image/png", buffer: PNG });
  await item.getByRole("button", { name: "Registrar" }).click();
  await expect(item).toContainText("Firmado", { timeout: 10_000 });
  await expect(item.getByRole("link", { name: "Ver formato firmado" })).toHaveAttribute("href", /token=/);
});

test("recepción no ve consentimientos", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}`);
  await expect(page.getByRole("link", { name: "Consentimientos" })).toHaveCount(0);
});

test("con el consentimiento firmado, la odontóloga firma la evolución y la exodoncia queda realizada", async ({ page }) => {
  expect(pacienteId, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/evolucion`);
  const borrador = page.getByRole("article", { name: /Evolución en borrador/ });
  await expect(borrador).not.toContainText("Falta el consentimiento informado firmado");
  page.once("dialog", (d) => void d.accept());
  await borrador.getByRole("button", { name: "Firmar y cerrar" }).click();
  await expect(page.getByRole("article", { name: /Evolución en borrador/ })).toHaveCount(0);
  await page.goto(`/pacientes/${pacienteId}/plan`);
  await expect(page.locator("li[data-item]").filter({ hasText: "Exodoncia simple" })).toContainText("Realizado");
});
