import { expect, test, type Page } from "@playwright/test";
import { conEtapa5, conSupabaseLocal, dniAlAzar, entrar, registrarYEsperarFicha } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa5, "Crea datos: solo contra Supabase local con la Etapa 5 encendida");
test.describe.configure({ mode: "serial" });

let pacienteId = "";

async function crearPaciente(page: Page) {
  await page.goto("/pacientes/nuevo");
  await page.getByLabel("Número de documento").fill(dniAlAzar());
  await page.getByLabel("Nombres").fill("Hugo");
  await page.getByLabel("Apellidos").fill(`Plan${dniAlAzar()}`);
  await page.getByLabel("Fecha de nacimiento").fill("1970-11-03");
  await page.getByLabel("Sexo").selectOption("masculino");
  await page.locator("#campo-telefono").fill("944777888");
  await page.getByLabel(/autoriza el tratamiento de sus datos/).check();
  await registrarYEsperarFicha(page);
  pacienteId = page.url().split("/pacientes/")[1]?.split("?")[0] ?? "";
  expect(pacienteId).toMatch(/^[0-9a-f-]{36}$/);
}

const item = (page: Page, texto: string) => page.locator("li[data-item]").filter({ hasText: texto });

test("la odontóloga arma el plan desde un diagnóstico, con fases, precio ajustado y orden", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await crearPaciente(page);

  // Diagnóstico de origen
  await page.goto(`/pacientes/${pacienteId}/examen`);
  await page.locator("#d-cie10").fill("K04.0");
  await page.getByRole("radio", { name: "Definitivo" }).check();
  await page.locator("#d-pieza").fill("36");
  await page.getByRole("button", { name: "Registrar diagnóstico" }).click();
  await expect(page.getByText("Diagnóstico K04.0 registrado.")).toBeVisible();
  await page.locator("li[data-diagnostico]").filter({ hasText: "K04.0" }).getByRole("link", { name: "Agregar al plan" }).click();

  // Sin plan: primero se crea
  await expect(page.getByText("Para agregar el diagnóstico a un plan, primero crea el plan.")).toBeVisible();
  await page.getByLabel("Título del plan").fill("Endodoncia y corona de la 36");
  await page.getByLabel("Primera fase").fill("Tratamiento pulpar");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.getByRole("heading", { name: "Endodoncia y corona de la 36" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fase 1: Tratamiento pulpar" })).toBeVisible();

  // Ítem 1: del catálogo, con su diagnóstico de origen
  await page.locator("#i-procedimiento").selectOption({ label: "END-02 · Endodoncia multirradicular" });
  const opcionDx = await page.locator("#i-diagnostico option").filter({ hasText: "K04.0" }).textContent();
  await page.locator("#i-diagnostico").selectOption({ label: opcionDx ?? "" });
  await page.locator("#i-pieza").fill("36");
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText("Agregado: Endodoncia multirradicular.")).toBeVisible();
  await expect(item(page, "Endodoncia multirradicular")).toContainText("S/ 750.00");
  await expect(item(page, "Endodoncia multirradicular")).toContainText("Dx K04.0");

  // Fase 2 e ítem 2 con precio ajustado, después del 1
  await page.getByText("Agregar fase").click();
  await page.getByLabel("Nombre de la fase nueva").fill("Rehabilitación");
  await page.getByRole("button", { name: "Guardar fase" }).click();
  await expect(page.getByRole("heading", { name: "Fase 2: Rehabilitación" })).toBeVisible();
  await page.locator("#i-procedimiento").selectOption({ label: "REH-02 · Corona de zirconio" });
  await page.locator("#i-precio").fill("1650");
  await page.locator("#i-pieza").fill("36");
  await page.locator("#i-fase").selectOption({ label: "2. Rehabilitación" });
  await page.getByRole("checkbox", { name: /^1\. Endodoncia multirradicular/ }).check();
  await page.getByRole("button", { name: "Agregar al plan" }).click();
  await expect(page.getByText("Agregado: Corona de zirconio.")).toBeVisible();
  await expect(item(page, "Corona de zirconio")).toContainText("S/ 1,650.00");
  await expect(item(page, "Corona de zirconio")).toContainText("después de #1");
  await expect(page.getByText("S/ 2,400.00")).toBeVisible();   // total

  // Alternativa B: copia fases, ítems y orden
  await page.getByRole("button", { name: "Nueva alternativa" }).click();
  await expect(page.getByText(/Versión 1 · Alternativa B · presentado/)).toBeVisible();
  await expect(item(page, "Corona de zirconio")).toContainText("después de #1");
});

test("recepción registra que el paciente eligió la alternativa B", async ({ page }) => {
  expect(pacienteId, "depende de la primera prueba de este archivo").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/plan`);
  const planes = page.getByRole("navigation", { name: "Planes del paciente" });
  await planes.getByRole("link", { name: /Versión 1 · Alternativa B/ }).click();
  await expect(page.getByText(/Versión 1 · Alternativa B · presentado/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agregar ítem" })).toHaveCount(0);   // recepción no arma el plan
  await expect(page.getByText("Dx K04.0")).toHaveCount(0);                             // ni ve el diagnóstico
  await page.getByRole("button", { name: "Registrar aceptación" }).click();
  await expect(planes.getByRole("link", { name: /Alternativa B/ })).toContainText("Aceptado");
  await expect(planes.getByRole("link", { name: /Alternativa A/ })).toContainText("Rechazado");
  await planes.getByRole("link", { name: /Alternativa A/ }).click();
  await expect(page.getByText("Motivo: Se eligió la alternativa B")).toBeVisible();
});

test("la asistente ve el plan pero no lo cambia", async ({ page }) => {
  expect(pacienteId, "depende de la primera prueba de este archivo").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`/pacientes/${pacienteId}/plan`);
  await expect(page.getByRole("heading", { name: "Endodoncia y corona de la 36" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva versión" })).toHaveCount(0);
  await expect(page.getByText("Cancelar", { exact: true })).toHaveCount(0);
});
