import { expect, test, type Page } from "@playwright/test";
import { conEtapa7, conSupabaseLocal, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa7, "Crea datos: solo contra Supabase local con la Etapa 7 encendida");
test.describe.configure({ mode: "serial" });

let fichaUrl = "";
const MARCA = `Clorhexidina ${Date.now()}`;

async function abrirUnPaciente(page: Page) {
  await page.goto("/pacientes");
  await page.getByRole("link").filter({ hasText: /, / }).nth(2).click();
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}$/);
  fichaUrl = page.url();
}

test("la odontóloga emite una receta escrita por ella y la imprime con su COP", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await abrirUnPaciente(page);
  await page.getByRole("link", { name: "Recetas y documentos" }).click();
  await page.waitForURL(/\/documentos$/);

  // Una fila empezada debe completarse: el sistema no sugiere dosis
  await page.getByLabel("Medicamento 1").fill(MARCA);
  await page.getByRole("button", { name: "Emitir receta" }).click();
  await expect(page.getByText("Completa: presentación, dosis, frecuencia, duración.")).toBeVisible();

  await page.getByLabel("Presentación 1").fill("0.12% colutorio");
  await page.getByLabel("Dosis 1").fill("15 ml");
  await page.getByLabel("Frecuencia 1").fill("cada 12 horas");
  await page.getByLabel("Duración 1").fill("7 días");
  await page.getByLabel("Indicaciones generales (opcional)").fill("No enjuagarse con agua después.");
  await page.getByRole("button", { name: "Emitir receta" }).click();
  await expect(page.getByText("Receta emitida.")).toBeVisible();
  const receta = page.locator("li[data-receta]").filter({ hasText: MARCA });
  await expect(receta).toContainText("15 ml, cada 12 horas, 7 días");

  const enlace = await receta.getByRole("link", { name: "Imprimir receta" }).getAttribute("href");
  await page.goto(enlace ?? "");
  await expect(page.getByText("Rp.")).toBeVisible();
  await expect(page.getByText(`${MARCA} — 0.12% colutorio`)).toBeVisible();
  await expect(page.getByText(/Cirujano dentista · COP \d+/)).toBeVisible();
});

test("la odontóloga emite un certificado de descanso de 2 días", async ({ page }) => {
  expect(fichaUrl, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto(`${fichaUrl}/documentos`);
  await page.getByRole("radio", { name: "Certificado de descanso" }).check();
  await page.getByLabel("Días de descanso").fill("2");
  // Etapa 13: el certificado de descanso menciona el tratamiento realizado
  await page.getByLabel("Tratamiento realizado").fill("");
  await page.getByRole("button", { name: "Emitir documento" }).click();
  await expect(page.getByText("Indica el tratamiento realizado (es parte del porqué del descanso).")).toBeVisible();
  await page.getByLabel("Tratamiento realizado").fill("Exodoncia de la pieza 38");
  await page.getByRole("button", { name: "Emitir documento" }).click();
  await expect(page.getByText("Documento emitido: ábrelo para imprimirlo.")).toBeVisible();
  const doc = page.locator("li[data-constancia]").filter({ hasText: "Certificado de descanso" }).first();
  await expect(doc).toContainText("2 días");
  const enlace = await doc.getByRole("link", { name: "Imprimir" }).getAttribute("href");
  await page.goto(enlace ?? "");
  await expect(page.getByRole("heading", { name: "Certificado de descanso" })).toBeVisible();
  await expect(page.getByText(/requiere descanso por/)).toContainText("2 días");
  await expect(page.getByText("Tratamiento realizado: Exodoncia de la pieza 38.")).toBeVisible();
});

test("recepción no ve recetas ni documentos clínicos", async ({ page }) => {
  expect(fichaUrl, "depende de la prueba anterior").not.toBe("");
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto(fichaUrl);
  await expect(page.getByRole("link", { name: "Recetas y documentos" })).toHaveCount(0);
  await page.goto(`${fichaUrl}/documentos`);
  await expect(page).toHaveURL(fichaUrl);
});
