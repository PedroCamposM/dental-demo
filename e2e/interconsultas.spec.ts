import { expect, test } from "@playwright/test";
import { conEtapa7, conSupabaseLocal, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa7, "Crea datos: solo contra Supabase local con la Etapa 7 encendida");
test.describe.configure({ mode: "serial" });

let fichaUrl = "";
const MOTIVO = `Evaluar mordida cruzada antes de rehabilitar ${Date.now()}`;
const EXTERNA = `Riesgo quirúrgico antes de exodoncias ${Date.now()}`;

test("la odontóloga pide una interconsulta interna y otra externa", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/pacientes");
  await page.getByRole("link").filter({ hasText: /, / }).nth(3).click();
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}$/);
  fichaUrl = page.url();
  await page.getByRole("link", { name: "Interconsultas" }).click();
  await page.waitForURL(/\/interconsultas$/);

  await page.getByRole("radio", { name: /^Interna/ }).check();
  await page.getByLabel("Profesional").selectOption({ label: "Dra. Lucía Valverde Ríos" });
  await page.getByLabel("Motivo de la interconsulta").fill(MOTIVO);
  await page.getByRole("button", { name: "Registrar interconsulta" }).click();
  await expect(page.getByText("Interconsulta enviada: el profesional la verá en sus pendientes.")).toBeVisible();

  await page.getByRole("radio", { name: /^Externa/ }).check();
  await page.getByLabel("Se deriva a").fill("Cardiología");
  await page.getByLabel("Motivo de la interconsulta").fill(EXTERNA);
  await page.getByLabel("Datos clínicos relevantes (opcional)").fill("Hipertensión controlada.");
  await page.getByRole("button", { name: "Registrar interconsulta" }).click();
  await expect(page.getByText("Interconsulta registrada: imprímela para el paciente.")).toBeVisible();
  const externa = page.locator("li[data-interconsulta]").filter({ hasText: EXTERNA });
  const enlace = await externa.getByRole("link", { name: "Imprimir interconsulta" }).getAttribute("href");
  await page.goto(enlace ?? "");
  await expect(page.getByRole("heading", { name: "Interconsulta" })).toBeVisible();
  await expect(page.getByText("Respuesta del especialista")).toBeVisible();
  await expect(page.getByText(/Solicita: .* · COP \d+/)).toBeVisible();
});

test("la destinataria la ve en sus pendientes y responde", async ({ page }) => {
  expect(fichaUrl, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "valverde@clinica-demo.example");
  await page.goto("/pacientes");
  const pendientes = page.getByRole("region", { name: "Interconsultas por responder" });
  await pendientes.getByRole("listitem").filter({ hasText: MOTIVO }).getByRole("link").click();
  const item = page.locator("li[data-interconsulta]").filter({ hasText: MOTIVO });
  await item.getByLabel("Respuesta o resultado").fill("Requiere ortodoncia previa por 12 meses.");
  await item.getByRole("button", { name: "Guardar respuesta" }).click();
  await expect(item).toContainText("Respondida");
  await expect(item).toContainText("Requiere ortodoncia previa por 12 meses.");
});

test("la asistente registra el resultado de la externa", async ({ page }) => {
  expect(fichaUrl, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "asistente@clinica-demo.example");
  await page.goto(`${fichaUrl}/interconsultas`);
  await expect(page.getByRole("button", { name: "Registrar interconsulta" })).toHaveCount(0);
  const item = page.locator("li[data-interconsulta]").filter({ hasText: EXTERNA });
  await item.getByText("Registrar el resultado").click();
  await item.getByLabel("Respuesta o resultado").fill("Riesgo quirúrgico II/IV según cardiología.");
  await item.getByRole("button", { name: "Guardar respuesta" }).click();
  await expect(item).toContainText("Respondida");
});

test("recepción no ve interconsultas", async ({ page }) => {
  expect(fichaUrl, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(fichaUrl);
  await expect(page.getByRole("link", { name: "Interconsultas" })).toHaveCount(0);
});
