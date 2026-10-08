import { expect, test } from "@playwright/test";

test("sin sesión, la app manda al login y recuerda adónde ibas", async ({ page }) => {
  await page.goto("/pacientes?orden=antiguedad");
  await expect(page).toHaveURL(/\/login\?next=%2Fpacientes%3Forden%3Dantiguedad$/);
  await expect(page.getByRole("heading", { name: "Dental Demo" })).toBeVisible();
  await expect(page.getByText("Mira cuánta plata tienes en riesgo")).toBeVisible();
});

test("el formulario de login pide correo y contraseña", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
});
