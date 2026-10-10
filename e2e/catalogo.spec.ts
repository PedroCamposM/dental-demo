import { expect, test } from "@playwright/test";
import { conEtapa2, conSupabaseLocal, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa2, "Crea datos: solo contra Supabase local con la Etapa 2 encendida");

test("el admin mantiene el catálogo de procedimientos y aranceles", async ({ page }) => {
  await entrar(page, "valverde@clinica-demo.example");
  await page.getByRole("link", { name: "Configuración" }).click();
  await page.getByRole("link", { name: "Procedimientos y aranceles" }).click();
  await expect(page.getByRole("heading", { name: "Endodoncia", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Endodoncia multirradicular.*S\/ 750\.00/ })).toBeVisible();

  // Alta con errores: el servidor los explica y conserva lo elegido
  const codigo = `PRB-${Date.now().toString().slice(-6)}`;
  await page.getByRole("link", { name: "Nuevo procedimiento" }).click();
  await page.locator("#campo-codigo").fill(codigo);
  await page.locator("#campo-nombre").fill(`Carilla de prueba ${codigo}`);
  await page.locator("#campo-especialidad").selectOption("estetica");
  await page.locator("#campo-precio").fill("-10");
  await page.getByRole("button", { name: "Agregar al catálogo" }).click();
  await expect(page.getByText("El precio no puede ser negativo.")).toBeVisible();
  await expect(page.locator("#campo-especialidad")).toHaveValue("estetica");

  await page.locator("#campo-precio").fill("850.50");
  await page.locator("#campo-duracion_minutos").selectOption("60");
  await page.getByLabel(/Requiere consentimiento/).check();
  await page.getByRole("button", { name: "Agregar al catálogo" }).click();
  await expect(page.getByText(`Procedimiento ${codigo} guardado.`)).toBeVisible();
  const fila = page.getByRole("row", { name: new RegExp(`Carilla de prueba ${codigo}`) });
  await expect(fila).toContainText("S/ 850.50");
  await expect(fila).toContainText("1 h");
  await expect(fila).toContainText("Sí");

  // El código no se repite
  await page.getByRole("link", { name: "Nuevo procedimiento" }).click();
  await page.locator("#campo-codigo").fill(codigo.toLowerCase());
  await page.locator("#campo-nombre").fill("Otro nombre cualquiera");
  await page.locator("#campo-especialidad").selectOption("general");
  await page.locator("#campo-precio").fill("10");
  await page.getByRole("button", { name: "Agregar al catálogo" }).click();
  await expect(page.getByText("Ya hay un procedimiento con este código.")).toBeVisible();

  // Editar el precio y desactivarlo: deja de aparecer, salvo al mostrar inactivos
  await page.goto("/configuracion/procedimientos");
  await page.getByRole("link", { name: `Editar Carilla de prueba ${codigo}` }).click();
  await page.locator("#campo-precio").fill("900");
  await page.getByLabel("Activo").uncheck();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(`Procedimiento ${codigo} guardado.`)).toBeVisible();
  await expect(fila).toHaveCount(0);
  await page.getByRole("link", { name: /Mostrar inactivos/ }).click();
  await expect(fila).toContainText("S/ 900.00");
  await expect(fila).toContainText("Inactivo");
});

test("quien no es admin no entra al catálogo", async ({ page }) => {
  await entrar(page, "alvarado@clinica-demo.example");
  await page.goto("/configuracion/procedimientos");
  await expect(page).toHaveURL(/\/pacientes$/);
});
