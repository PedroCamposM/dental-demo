import { expect, test } from "@playwright/test";
import { conEtapa8, conSupabaseLocal, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa8, "Solo contra Supabase local con la Etapa 8 encendida");

test("la odontóloga ve el tablero clínico con sus secciones", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.getByRole("link", { name: "Tablero clínico" }).click();
  await expect(page.getByRole("heading", { name: "Tablero clínico", level: 1 })).toBeVisible();
  for (const titulo of ["Evoluciones sin firmar", "Consentimientos pendientes", "Controles vencidos", "Tratamientos en curso",
    "Tratamientos detenidos"]) {
    await expect(page.getByRole("region", { name: titulo })).toBeVisible();
  }
  await expect(page.getByRole("alert").filter({ hasText: "No se pudo cargar" })).toHaveCount(0);
  // El seed tiene controles vencidos y tratamientos detenidos
  await expect(page.getByRole("region", { name: "Controles vencidos" }).getByRole("listitem").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Tratamientos detenidos" }).getByRole("listitem").first()).toBeVisible();
});

test("recepción no ve el tablero clínico", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await expect(page.getByRole("link", { name: "Tablero clínico" })).toHaveCount(0);
  await page.goto("/clinico");
  await expect(page).toHaveURL(/\/gestion/);
});
