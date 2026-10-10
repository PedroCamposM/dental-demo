import { expect, test, type Page } from "@playwright/test";
import { conEtapa10, conSupabaseLocal, entrar } from "./ayudantes";

// Guion de la demo (docs/guion-demo.md): recorre los casos que trae el seed. Solo lee: no
// cambia datos, así se puede correr en paralelo con las demás pruebas. Los nombres salen
// del seed (setseed fijo), iguales en local, en CI y en el remoto.
test.skip(!conSupabaseLocal || !conEtapa10, "Usa los datos del seed: solo contra Supabase local con las etapas encendidas");

async function abrirPaciente(page: Page, apellidos: string, nombres: string) {
  await page.goto(`/pacientes?q=${encodeURIComponent(apellidos)}`);
  await page.getByRole("link", { name: new RegExp(`^${apellidos}, ${nombres}`) }).click();
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}$/);
  return page.url().split("/pacientes/")[1] ?? "";
}

test("alertas clínicas: alergia a penicilina y anticoagulado, en toda vista del paciente", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  const alergica = await abrirPaciente(page, "Zavaleta Cerna", "Diana");
  const alertas = page.getByRole("note", { name: "Alertas clínicas" });
  await expect(alertas).toContainText("Alergia: Penicilina");
  await page.goto(`/pacientes/${alergica}/plan`);
  await expect(alertas).toContainText("Alergia: Penicilina");

  await abrirPaciente(page, "Horna Cerna", "Jimena");
  await expect(alertas).toContainText("Anticoagulado: Warfarina 5 mg diaria");
});

test("tablero clínico: retiro de puntos vencido y laboratorio atrasado", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await page.goto("/clinico");
  // El retiro de puntos vencido figura aunque el paciente ya tenga cita más adelante
  const vencidos = page.getByRole("region", { name: "Controles vencidos" });
  await expect(vencidos.getByRole("listitem").filter({ hasText: "Benites Neyra" })).toContainText("Retiro de puntos");
  const lab = page.getByRole("region", { name: "Trabajos de laboratorio por llegar" });
  await expect(lab).toContainText("Atrasado");
  for (const titulo of ["Tratamientos en curso", "Tratamientos detenidos", "Evoluciones sin firmar", "Consentimientos pendientes"]) {
    await expect(page.getByRole("region", { name: titulo })).toBeVisible();
  }

  await page.goto("/laboratorio");
  await expect(page.getByText(/Atrasada \d+ días?/).first()).toBeVisible();
});

test("especialidades: implante en fase protésica y ortodoncia con controles mensuales", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  const implante = await abrirPaciente(page, "Lescano Torres", "Diana");
  await page.goto(`/pacientes/${implante}/especialidades`);
  await expect(page.getByRole("region", { name: "Implantes" })).toContainText("Fase protésica");

  const orto = await abrirPaciente(page, "Cruz Ruiz", "Camila");
  await page.goto(`/pacientes/${orto}/especialidades`);
  await expect(page.getByRole("region", { name: "Ortodoncia" })).toContainText("Controles (5)");
});

test("cirugía con retiro de puntos pendiente: en los controles de la ficha", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  await abrirPaciente(page, "Benites Neyra", "Ricardo");
  await expect(page.getByRole("region", { name: "Controles programados" })).toContainText("Retiro de puntos");
  await page.goto(page.url() + "/especialidades");
  await expect(page.getByRole("region", { name: "Cirugía" })).toContainText("Técnica:");
});

test("niño con apoderado y registro de odontopediatría", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  const nino = await abrirPaciente(page, "Ramírez Burgos", "Víctor");
  await expect(page.getByRole("heading", { name: "Apoderado", level: 3 })).toBeVisible();
  await page.goto(`/pacientes/${nino}/especialidades`);
  await expect(page.getByRole("region", { name: "Odontopediatría" })).toBeVisible();
});

test("periodontograma: comparación entre dos fechas", async ({ page }) => {
  await entrar(page, "mendoza@clinica-demo.example");
  const perio = await abrirPaciente(page, "Alvarado Rodríguez", "Mariela");
  await page.goto(`/pacientes/${perio}/periodontograma`);
  const comparar = page.getByRole("region", { name: "Comparar fechas" });
  await comparar.getByRole("button", { name: "Comparar" }).click();
  await expect(comparar.getByRole("heading", { name: /Sitios que cambiaron/ })).toBeVisible();
});

test("gestión: la recepción ve el tablero de gestión pero no las notas clínicas", async ({ page }) => {
  await entrar(page, "recepcion@clinica-demo.example");
  await page.goto("/gestion");
  await expect(page.getByRole("heading", { name: "Tablero de gestión", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tablero clínico" })).toHaveCount(0);
  await abrirPaciente(page, "Zavaleta Cerna", "Diana");
  await expect(page.getByRole("link", { name: "Plan de tratamiento" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Evolución", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Historia clínica" })).toHaveCount(0);
});
