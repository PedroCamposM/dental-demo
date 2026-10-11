import { expect, test } from "@playwright/test";
import { conEtapa18, conSupabaseLocal } from "./ayudantes";
import { hayPsql, registrarCuenta, sql } from "./plataforma";

// Etapa 18: gestión de clientes. Resumen, búsqueda y filtros, por contactar, ficha con uso por
// semana (solo conteos) y notas internas. La tarea diaria de correos exige su clave.
test.skip(!conSupabaseLocal || !conEtapa18 || !hayPsql, "Crea cuentas y clínicas: Supabase local, Etapa 18 y psql");
test.describe.configure({ mode: "serial" });

const sufijo = `${Date.now()}`;
const CLINICA = `Consultorio Gestión ${sufijo}`;
const CLAVE = "Prueba2026x";

test("la tarea diaria de correos no responde sin su clave", async ({ request }) => {
  const r = await request.get("/api/cron/correos");
  expect(r.status()).toBe(401);
  const otra = await request.get("/api/cron/correos", { headers: { authorization: "Bearer cualquiera" } });
  expect(otra.status()).toBe(401);
});

test("el superadministrador ve el resumen, busca, contacta y anota", async ({ page, browser }) => {
  // Una clínica de prueba que vence en 3 días
  const clinica = await browser.newPage();
  await registrarCuenta(clinica, `gestion-${sufijo}@clinica-nueva.example`, CLAVE, CLINICA, "9890");
  await clinica.getByRole("button", { name: "Crear mi clínica" }).click();
  await expect(clinica).toHaveURL(/\/pacientes/);
  await clinica.close();
  sql(`update public.clinica set prueba_hasta = (now() at time zone 'America/Lima')::date + 3, telefono = '987654321'
        where nombre = '${CLINICA}'`);

  const SUPER = `super-gestion-${sufijo}@plataforma.example`;
  await registrarCuenta(page, SUPER, CLAVE, "No se crea", "");
  sql(`insert into privado.superadmin (usuario_id) select id from auth.users where email = '${SUPER}'`);
  await page.goto("/plataforma");
  await expect(page.getByText("Ingreso mensual")).toBeVisible();
  await expect(page.getByText("Conversión prueba → pago")).toBeVisible();

  // Por contactar: vence en 3 días, con correo y WhatsApp
  const fila = page.getByRole("region", { name: /Por contactar/ }).getByRole("row").filter({ hasText: CLINICA });
  await expect(fila.getByText("Vence en 3 días (prueba)")).toBeVisible();
  await expect(fila.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/51987654321/);
  await expect(fila.getByRole("link", { name: "Correo" })).toHaveAttribute("href", /^mailto:gestion-/);

  // Buscar y filtrar
  const buscar = page.getByRole("search", { name: "Buscar clínicas" });
  await buscar.getByLabel("Buscar").fill(sufijo);
  await buscar.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("heading", { name: /^Clínicas \(1 de \d+\)$/ })).toBeVisible();
  await buscar.getByLabel("Estado").selectOption("vencido");
  await buscar.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("heading", { name: /^Clínicas \(0 de \d+\)$/ })).toBeVisible();
  await page.getByRole("link", { name: "Quitar filtros" }).click();

  // Ficha: uso por semana (los 3 pacientes de ejemplo), usuarios y nota interna
  await page.getByRole("heading", { level: 2 }).getByRole("link", { name: CLINICA }).click();
  await expect(page).toHaveURL(/\/plataforma\/clinicas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: CLINICA })).toBeVisible();
  const uso = page.getByRole("region", { name: "Uso por semana" });
  await expect(uso.getByRole("row").last().getByRole("cell").nth(1)).toHaveText("3");
  await expect(page.getByRole("region", { name: "Usuarios" }).getByText(`gestion-${sufijo}@clinica-nueva.example`)).toBeVisible();
  const notas = page.getByRole("region", { name: "Notas internas" });
  await notas.getByLabel(/Nota interna/).fill("Llamé: quiere el plan anual");
  await notas.getByRole("button", { name: "Guardar nota" }).click();
  await expect(notas.getByText("Llamé: quiere el plan anual")).toBeVisible();
});
