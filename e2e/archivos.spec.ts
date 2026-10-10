import { expect, test, type Page } from "@playwright/test";
import { conEtapa7, conSupabaseLocal, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa7, "Sube archivos: solo contra Supabase local con la Etapa 7 encendida");
test.describe.configure({ mode: "serial" });

// PNG de 1×1 píxel (ficticio)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const DESCRIPCION = `Periapical de control ${Date.now()}`;
let fichaUrl = "";

async function abrirUnPaciente(page: Page) {
  await page.goto("/pacientes");
  await page.getByRole("link").filter({ hasText: /, / }).first().click();
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}$/);
  fichaUrl = page.url();
}

test("la asistente sube una radiografía y se ve con enlace temporal", async ({ page }) => {
  await entrar(page, "asistente@clinica-demo.example");
  await abrirUnPaciente(page);
  await page.getByRole("link", { name: "Imágenes y archivos" }).click();
  await page.waitForURL(/\/archivos$/);

  // Formato no admitido: avisa antes de subir
  await page.locator("#a-archivo").setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await page.getByRole("button", { name: "Guardar archivo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Formato no admitido" })).toBeVisible();

  await page.locator("#a-archivo").setInputFiles({ name: "rx-36.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("Pieza (opcional)").fill("36");
  await page.getByLabel("Descripción (opcional)").fill(DESCRIPCION);
  await page.getByRole("button", { name: "Guardar archivo" }).click();
  await expect(page.getByText("Archivo guardado.")).toBeVisible();

  const tarjeta = page.locator("li[data-archivo]").filter({ hasText: DESCRIPCION });
  await expect(tarjeta).toContainText("pieza 36");
  await expect(tarjeta).toContainText("Solo uso clínico");
  const img = tarjeta.getByRole("img");
  await expect(img).toHaveAttribute("src", /token=/);
  // La imagen carga desde el bucket privado con la URL firmada
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1);
});

test("recepción no ve imágenes ni archivos clínicos", async ({ page }) => {
  expect(fichaUrl, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(fichaUrl);
  await expect(page.getByRole("link", { name: "Imágenes y archivos" })).toHaveCount(0);
  await page.goto(`${fichaUrl}/archivos`);
  await expect(page).toHaveURL(fichaUrl);
});

test("la odontóloga anula el archivo con motivo y queda a la vista", async ({ page }) => {
  expect(fichaUrl, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto(`${fichaUrl}/archivos?tipo=radiografia`);
  const tarjeta = page.locator("li[data-archivo]").filter({ hasText: DESCRIPCION });
  await tarjeta.getByText("Anular", { exact: true }).click();
  await tarjeta.getByLabel(/Motivo para anular/).fill("Corresponde a otro paciente");
  await tarjeta.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(tarjeta).toContainText("Anulado: Corresponde a otro paciente");
  await expect(tarjeta.getByRole("img")).toHaveCount(0);
});
