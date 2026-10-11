import { expect, test } from "@playwright/test";
import { conEtapa17, conSupabaseLocal } from "./ayudantes";
import { hayPsql, ingresar, registrarCuenta, sql } from "./plataforma";

// Etapa 17: suscripción con cobro manual. La clínica vencida reporta su pago con la constancia,
// el superadministrador lo confirma y el plan se reactiva solo.
test.skip(!conSupabaseLocal || !conEtapa17 || !hayPsql, "Crea cuentas y clínicas: Supabase local, Etapa 17 y psql");
test.describe.configure({ mode: "serial" });

const sufijo = `${Date.now()}`;
const CLINICA = `Consultorio Pago ${sufijo}`;
const ADMIN = `pago-${sufijo}@clinica-nueva.example`;
const SUPER = `super-pago-${sufijo}@plataforma.example`;
const CLAVE = "Prueba2026x";
// PNG de 1×1 píxel
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("la clínica vencida ve los planes y reporta su pago con la constancia", async ({ page }) => {
  await registrarCuenta(page, ADMIN, CLAVE, CLINICA, "9860");
  await page.getByRole("button", { name: "Crear mi clínica" }).click();
  await expect(page).toHaveURL(/\/pacientes/);
  sql(`update public.clinica set prueba_hasta = (now() at time zone 'America/Lima')::date - 1 where nombre = '${CLINICA}'`);
  await page.reload();
  await page.getByRole("link", { name: "Ver planes y reportar tu pago" }).click();
  await expect(page).toHaveURL(/\/configuracion\/plan$/);
  await expect(page.getByText(/Está vencido: la clínica está en solo lectura/)).toBeVisible();
  await expect(page.getByText("Odontólogos activos (con COP): 1. Te corresponde el plan Consultorio.")).toBeVisible();
  const precios = page.getByRole("region", { name: "Planes y precios" });
  await expect(precios.getByRole("row", { name: /Consultorio 1 a 2 odontólogos S\/ 99\.00/ })).toBeVisible();
  // Sin datos de cobro todavía: indica el correo
  await expect(page.getByRole("region", { name: "Cómo pagar" }).getByText(/Escríbenos a/)).toBeVisible();

  const reporte = page.getByRole("region", { name: "Reportar un pago" });
  await reporte.getByLabel("N.º de operación").fill("12");
  await reporte.getByRole("button", { name: "Reportar pago" }).click();
  await expect(reporte.getByText(/Escribe el número de operación/)).toBeVisible();
  await reporte.getByLabel("N.º de operación").fill(`OP${sufijo.slice(-8)}`);
  await reporte.getByLabel(/Constancia/).setInputFiles({ name: "yape.png", mimeType: "image/png", buffer: PNG });
  await reporte.getByRole("button", { name: "Reportar pago" }).click();
  await expect(reporte.getByText(/Pago reportado/)).toBeVisible();
  const historial = page.getByRole("region", { name: "Pagos reportados" });
  await expect(historial.getByText("Por confirmar")).toBeVisible();
  await expect(historial.getByText(/S\/ 99\.00 · Yape/)).toBeVisible();
  // Un segundo reporte espera al primero
  await reporte.getByLabel("N.º de operación").fill(`OQ${sufijo.slice(-8)}`);
  await reporte.getByRole("button", { name: "Reportar pago" }).click();
  await expect(reporte.getByText(/Ya tienes un pago por confirmar/)).toBeVisible();
});

test("el superadministrador confirma el pago y la clínica vuelve a registrar", async ({ page, browser }) => {
  const otra = await browser.newPage();
  await registrarCuenta(otra, SUPER, CLAVE, "No se crea", "");
  sql(`insert into privado.superadmin (usuario_id) select id from auth.users where email = '${SUPER}'`);
  await otra.goto("/plataforma");
  // Datos de cobro y precios
  const cobro = otra.getByRole("form", { name: "Datos de cobro" });
  await cobro.getByLabel("Yape (número)").fill("999 000 111");
  await cobro.getByLabel("Titular").fill("Titular de prueba");
  await cobro.getByRole("button", { name: "Guardar datos de cobro" }).click();
  await expect(cobro.getByText("Datos de cobro guardados.")).toBeVisible();
  // Confirmar el pago pendiente de la clínica
  const pago = otra.getByRole("listitem").filter({ hasText: CLINICA }).filter({ has: otra.getByRole("button", { name: "Confirmar pago" }) });
  await expect(pago.getByRole("link", { name: "Ver constancia" })).toBeVisible();
  otra.once("dialog", (d) => d.accept());
  await pago.getByRole("button", { name: "Confirmar pago" }).click();
  // Revisado, sale de la lista; la clínica queda activa
  await expect(pago).toHaveCount(0);
  await expect(otra.getByRole("listitem").filter({ hasText: CLINICA }).getByText(/^Activo hasta/)).toBeVisible();
  await otra.close();

  await ingresar(page, ADMIN, CLAVE);
  await expect(page.getByRole("heading", { name: "Pacientes" })).toBeVisible();
  await expect(page.getByText("La prueba gratuita terminó")).toHaveCount(0);
  await page.goto("/configuracion/plan");
  await expect(page.getByRole("region", { name: "Pagos reportados" }).getByText(/Confirmado \(plan hasta/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Cómo pagar" }).getByText("999 000 111")).toBeVisible();
  await expect(page.getByText(/Plan activo hasta el/)).toBeVisible();
});

test("el superadministrador rechaza un pago con motivo", async ({ page, browser }) => {
  await ingresar(page, ADMIN, CLAVE);
  await page.goto("/configuracion/plan");
  const reporte = page.getByRole("region", { name: "Reportar un pago" });
  await reporte.getByLabel("N.º de operación").fill(`OR${sufijo.slice(-8)}`);
  await reporte.getByRole("button", { name: "Reportar pago" }).click();
  await expect(reporte.getByText(/Pago reportado/)).toBeVisible();

  const otra = await browser.newPage();
  await ingresar(otra, SUPER, CLAVE);
  await otra.goto("/plataforma");
  const pago = otra.getByRole("listitem").filter({ hasText: CLINICA }).filter({ has: otra.getByRole("button", { name: "Rechazar" }) });
  await pago.getByRole("button", { name: "Rechazar" }).click();
  await expect(pago.getByText(/escribe el motivo/)).toBeVisible();
  await pago.getByLabel("Motivo (para rechazar)").fill("No aparece en la cuenta");
  await pago.getByRole("button", { name: "Rechazar" }).click();
  await expect(pago).toHaveCount(0);
  await otra.close();

  await page.reload();
  await expect(page.getByRole("region", { name: "Pagos reportados" }).getByText("Rechazado: No aparece en la cuenta")).toBeVisible();
});
