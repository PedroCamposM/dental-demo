import { expect, test } from "@playwright/test";

test("la página de inicio muestra la promesa de la demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dental Demo" })).toBeVisible();
  await expect(page.getByText("Mira cuánta plata tienes en riesgo")).toBeVisible();
});
