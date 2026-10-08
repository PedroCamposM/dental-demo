import { expect, test } from "@playwright/test";

// Necesita el proyecto de Supabase real con el seed cargado (.env.local con URL
// y publishable key). Sin eso, el login no tiene contra quién autenticarse.
test.skip(
  !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(".supabase.co"),
  "Requiere NEXT_PUBLIC_SUPABASE_URL y la publishable key del proyecto con el seed",
);

const PASSWORD = "DemoTrujillo2026";

test("contraseña incorrecta muestra un error claro", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("recepcion@clinica-demo.example");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Correo o contraseña incorrectos.");
});

for (const [email, nombre, rol] of [
  ["valverde@clinica-demo.example", "Dra. Lucía Valverde Ríos", "Administrador"],
  ["alvarado@clinica-demo.example", "Dr. Martín Alvarado Cruz", "Odontólogo"],
  ["recepcion@clinica-demo.example", "Rosa Chávez Liñán", "Recepción"],
] as const) {
  test(`${rol} entra, ve su clínica y cierra sesión`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Clínica Dental Demo – Trujillo")).toBeVisible();
    await expect(page.getByText(`${nombre} · ${rol}`)).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
}
