import { expect, test } from "@playwright/test";
import { conEtapa20, conSupabaseLocal } from "./ayudantes";
import { hayPsql, registrarCuenta, sql } from "./plataforma";

// Etapa 20: herramientas del superadministrador. La clínica cambia su nombre; el superadmin ve
// la ficha (activación), da un descuento, publica un aviso, suspende y reactiva; todo queda en
// la bitácora. La clínica ve el aviso, el descuento y la suspensión (solo lectura).
test.skip(!conSupabaseLocal || !conEtapa20 || !hayPsql, "Crea cuentas y clínicas: Supabase local, Etapa 20 y psql");
test.describe.configure({ mode: "serial" });

const sufijo = `${Date.now()}`;
const CLINICA = `Consultorio Herramientas ${sufijo}`;
const RENOMBRADA = `Clínica Renombrada ${sufijo}`;
const CLAVE = "Prueba2026x";

test("la clínica cambia su nombre y el superadministrador la gestiona", async ({ page, browser }) => {
  // La clínica se registra y corrige su nombre en Configuración
  await registrarCuenta(page, `herramientas-${sufijo}@clinica-nueva.example`, CLAVE, CLINICA, "9891");
  await page.getByRole("button", { name: "Crear mi clínica" }).click();
  await expect(page).toHaveURL(/\/pacientes/);
  await page.goto("/configuracion");
  const datos = page.getByRole("region", { name: "Datos de la clínica" });
  await datos.getByLabel("Nombre de la clínica").fill("X");
  await datos.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(datos.getByRole("alert")).toContainText("3 a 120");
  await datos.getByLabel("Nombre de la clínica").fill(RENOMBRADA);
  await datos.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(datos.getByRole("status")).toContainText("Nombre guardado");
  await page.reload();
  await expect(page.getByRole("banner").getByText(RENOMBRADA)).toBeVisible();

  // Superadministrador: ficha con activación, descuento, aviso y suspensión
  const sup = await browser.newPage();
  const SUPER = `super-herr-${sufijo}@plataforma.example`;
  await registrarCuenta(sup, SUPER, CLAVE, "No se crea", "");
  sql(`insert into privado.superadmin (usuario_id) select id from auth.users where email = '${SUPER}'`);
  await sup.goto("/plataforma");
  await expect(sup.getByText("Suspendidas")).toBeVisible();
  await sup.getByRole("link", { name: `Ver ficha de ${RENOMBRADA}` }).click();
  await expect(sup.getByRole("heading", { level: 1, name: RENOMBRADA })).toBeVisible();
  const activacion = sup.getByRole("region", { name: /^Activación/ });
  await expect(activacion.getByRole("heading")).toHaveText("Activación (0 de 5)");
  await expect(activacion.getByText("○ Registró un paciente real")).toBeVisible();

  const cuenta = sup.getByRole("region", { name: "Cuenta" });
  const descuento = cuenta.getByRole("form", { name: "Descuento" });
  await descuento.getByLabel("Descuento (%)").fill("15");
  await descuento.getByLabel("Motivo").fill("Clínica fundadora");
  await descuento.getByRole("button", { name: "Guardar descuento" }).click();
  await expect(descuento.getByRole("status")).toHaveText("Descuento del 15 % guardado.");

  const aviso = cuenta.getByRole("form", { name: "Nuevo aviso" });
  await aviso.getByLabel(/^Aviso/).fill(`Bienvenidos ${sufijo}: llámanos si necesitas ayuda`);
  await aviso.getByLabel("Tipo").selectOption("importante");
  await aviso.getByRole("button", { name: "Publicar aviso" }).click();
  await expect(aviso.getByRole("status")).toHaveText("Aviso publicado.");

  const suspender = cuenta.getByRole("form", { name: "Suspender la clínica" });
  await suspender.getByLabel("Motivo").fill("Prueba de suspensión");
  sup.once("dialog", (d) => d.accept());
  await suspender.getByRole("button", { name: "Suspender clínica" }).click();
  await expect(sup.getByText(/Suspendida desde el/)).toBeVisible();

  // La clínica ve el aviso, la suspensión y su descuento
  await page.goto("/configuracion/plan");
  await expect(page.getByText(`Bienvenidos ${sufijo}: llámanos si necesitas ayuda`)).toBeVisible();
  await expect(page.getByRole("banner").getByText(/La cuenta de la clínica está suspendida/)).toBeVisible();
  await expect(page.getByText(/Tienes un descuento del 15 %/)).toBeVisible();
  // Suspendida no registra (lo exige la base): intentar cambiar el nombre falla con el mensaje claro
  await page.goto("/configuracion");
  await page.getByLabel("Nombre de la clínica").fill(`${RENOMBRADA} B`);
  await page.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(page.getByRole("region", { name: "Datos de la clínica" }).getByRole("alert")).toContainText("solo lectura");

  // Reactivar y revisar la bitácora y los ingresos
  await sup.reload();
  const reactivar = sup.getByRole("region", { name: "Cuenta" }).getByRole("form", { name: "Reactivar la clínica" });
  await reactivar.getByLabel("Motivo").fill("Fin de la prueba");
  await reactivar.getByRole("button", { name: "Reactivar clínica" }).click();
  await expect(sup.getByText(/Suspendida desde el/)).toBeHidden();
  const bitacora = sup.getByRole("region", { name: "Bitácora del superadministrador" });
  for (const t of ["Reactivó la clínica", "Suspendió la clínica", "Publicó un aviso", "Dio un descuento"]) {
    await expect(bitacora.getByText(t)).toBeVisible();
  }
  await sup.goto("/plataforma/bitacora");
  await expect(sup.getByRole("link", { name: RENOMBRADA }).first()).toBeVisible();
  await sup.goto("/plataforma/ingresos");
  await expect(sup.getByRole("heading", { level: 1, name: "Ingresos" })).toBeVisible();
  const csv = await sup.request.get("/plataforma/ingresos/csv?desde=2026-01-01&hasta=2026-12-31");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Confirmado el,Clínica,Plan");

  // Una clínica no entra a las páginas del superadministrador ni al CSV
  expect((await page.request.get("/plataforma/ingresos/csv?desde=2026-01-01&hasta=2026-12-31")).status()).toBe(404);
  await sup.close();
});
