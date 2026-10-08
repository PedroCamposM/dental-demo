import { expect, test } from "@playwright/test";
import { conEtapa2, conSupabaseLocal, entrar } from "./ayudantes";

test.skip(!conSupabaseLocal || !conEtapa2, "Cambia la configuración: solo contra Supabase local con la Etapa 2 encendida");
// Comparten la configuración de la clínica demo: una tras otra.
test.describe.configure({ mode: "serial" });

test("el admin configura el horario de un odontólogo y lo deja como estaba", async ({ page }) => {
  await entrar(page, "valverde@clinica-demo.example");
  await page.goto("/configuracion/horarios");
  await expect(page.getByRole("heading", { name: "Sillones", exact: true })).toBeVisible();
  const horario = page.getByRole("form", { name: "Horario de Dra. Carla Mendoza Paredes" });
  await expect(horario.getByLabel("Lunes: desde")).toHaveValue("09:00");
  await expect(horario.getByLabel("Domingo: desde")).toBeDisabled();

  // Activar el domingo sin sillón: el servidor lo explica y no se pierde lo editado
  await horario.getByLabel("Domingo", { exact: true }).check();
  await horario.getByLabel("Domingo: desde").fill("09:00");
  await horario.getByLabel("Domingo: hasta").fill("13:00");
  await horario.getByRole("button", { name: /Guardar horario/ }).click();
  await expect(horario.getByText("Elige el sillón.")).toBeVisible();
  await expect(horario.getByLabel("Domingo: hasta")).toHaveValue("13:00");

  // Con su sillón, se guarda
  await horario.getByLabel("Domingo: sillón").selectOption({ label: "Sillón 2" });
  await horario.getByRole("button", { name: /Guardar horario/ }).click();
  await expect(horario.getByText("Horario guardado.")).toBeVisible();

  await page.reload();
  const recargado = page.getByRole("form", { name: "Horario de Dra. Carla Mendoza Paredes" });
  await expect(recargado.getByLabel("Domingo", { exact: true })).toBeChecked();
  await expect(recargado.getByLabel("Domingo: hasta")).toHaveValue("13:00");

  // Lo deja como estaba
  await recargado.getByLabel("Domingo", { exact: true }).uncheck();
  await recargado.getByRole("button", { name: /Guardar horario/ }).click();
  await expect(recargado.getByText("Horario guardado.")).toBeVisible();
});

test("dos odontólogos no comparten sillón a la misma hora", async ({ page }) => {
  await entrar(page, "valverde@clinica-demo.example");
  await page.goto("/configuracion/horarios");
  const horario = page.getByRole("form", { name: "Horario de Dr. Martín Alvarado Cruz" });
  await horario.getByLabel("Lunes: sillón").selectOption({ label: "Sillón 1" });
  await horario.getByRole("button", { name: /Guardar horario/ }).click();
  await expect(horario.getByText(/Ese sillón ya está asignado a Dra. Lucía Valverde Ríos ese día de 09:00 a 19:00/)).toBeVisible();
  // No se guardó nada: sigue en su sillón
  await page.reload();
  await expect(page.getByRole("form", { name: "Horario de Dr. Martín Alvarado Cruz" })
    .getByLabel("Lunes: sillón").locator("option:checked")).toHaveText("Sillón 3");
});

test("el admin bloquea la agenda y anula el bloqueo", async ({ page }) => {
  await entrar(page, "valverde@clinica-demo.example");
  await page.goto("/configuracion/horarios");
  const motivo = `Capacitación de prueba ${Date.now()}`;
  await page.locator("#bloqueo-tipo").selectOption("capacitacion");
  await page.locator("#bloqueo-motivo").fill(motivo);
  await page.getByRole("button", { name: "Bloquear agenda" }).click();
  await expect(page.getByText("Indica desde qué fecha.")).toBeVisible();
  await expect(page.locator("#bloqueo-motivo")).toHaveValue(motivo);

  const anio = new Date().getFullYear() + 1;
  await page.locator("#bloqueo-desde").fill(`${anio}-03-02`);
  await page.locator("#bloqueo-hasta").fill(`${anio}-03-03`);
  await page.getByRole("button", { name: "Bloquear agenda" }).click();
  await expect(page.getByText(/^Bloqueo creado\./)).toBeVisible();
  const fila = page.getByRole("listitem").filter({ hasText: motivo });
  await expect(fila).toContainText(`2 mar ${anio} – 3 mar ${anio}`);
  await expect(fila).toContainText("Capacitación · Toda la clínica");

  await fila.getByText("Anular", { exact: true }).click();
  await fila.getByLabel(/Motivo para anular/).fill("Se reprogramó");
  await fila.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: motivo })).toHaveCount(0);
});

test("quien no es admin no entra a la configuración de horarios", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto("/configuracion/horarios");
  await expect(page).toHaveURL(/\/pacientes$/);
});
