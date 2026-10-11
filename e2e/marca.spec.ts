import { expect, test } from "@playwright/test";
import { conEtapa15, conSupabaseLocal, entrar } from "./ayudantes";

// Etapa 15: personalización de la clínica (color, logo y membrete).
test.skip(!conSupabaseLocal || !conEtapa15, "Cambia la clínica de demo: solo contra Supabase local con la Etapa 15 encendida");

// PNG de 1×1 píxel
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("el administrador pone el color, el logo y el membrete de la clínica", async ({ page }) => {
  await entrar(page, "valverde@clinica-demo.example");
  await page.goto("/configuracion");
  const marca = page.getByRole("region", { name: "Marca de la clínica" });

  // Un color muy claro no deja leer el texto blanco de los botones
  await marca.getByLabel("Color en formato #RRGGBB").fill("#fde047");
  await marca.getByRole("button", { name: "Guardar marca" }).click();
  await expect(marca.getByText(/Ese color es muy claro/)).toBeVisible();

  await marca.getByLabel("Color en formato #RRGGBB").fill("#1d4ed8");
  await marca.getByLabel("Subir logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await marca.getByLabel("Dirección").fill("Av. España 1234, Trujillo");
  await marca.getByLabel("Teléfono").fill("044 123456");
  await marca.getByRole("button", { name: "Guardar marca" }).click();
  await expect(marca.getByText(/Guardado: la app y los documentos/)).toBeVisible();

  // La app usa el color y el logo
  await page.goto("/pacientes");
  await expect(page.locator("header style")).toHaveText(/--color-teal-700:#1d4ed8/);
  await expect(page.getByRole("banner").getByRole("img", { name: /^Logo de / })).toBeVisible();

  // Se deja la demo como estaba
  await page.goto("/configuracion");
  await marca.getByLabel("Color en formato #RRGGBB").fill("");
  await marca.getByLabel("Quitar el logo").check();
  await marca.getByLabel("Dirección").fill("");
  await marca.getByLabel("Teléfono").fill("");
  await marca.getByRole("button", { name: "Guardar marca" }).click();
  await expect(marca.getByText(/Guardado/)).toBeVisible();
  await page.goto("/pacientes");
  await expect(page.locator("header style")).toHaveCount(0);
});

test("el odontólogo no ve la configuración de la marca", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/configuracion");
  await expect(page).not.toHaveURL(/\/configuracion/);
});
