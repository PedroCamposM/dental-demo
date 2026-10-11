import { expect, test } from "@playwright/test";
import { conEtapa19, conSupabaseLocal } from "./ayudantes";
import { enlaceDelCorreo, ingresar, registrarCuenta } from "./plataforma";

// Etapa 19: el administrador invita a su equipo por correo; la persona crea su contraseña y
// entra con su rol; desactivada ya no entra. Recuperar la contraseña por correo.
test.skip(!conSupabaseLocal || !conEtapa19, "Envía correos de Auth: solo contra Supabase local con la Etapa 19 encendida");
test.describe.configure({ mode: "serial" });

const sufijo = `${Date.now()}`;
const ADMIN = `equipo-${sufijo}@clinica-nueva.example`;
const ASISTENTE = `asistente-${sufijo}@clinica-nueva.example`;
const CLAVE = "Prueba2026x";

test("el administrador invita a una asistente y ella crea su contraseña", async ({ page, browser }) => {
  await registrarCuenta(page, ADMIN, CLAVE, `Consultorio Equipo ${sufijo}`, "9870");
  await page.getByRole("button", { name: "Crear mi clínica" }).click();
  await expect(page).toHaveURL(/\/pacientes/);
  await page.goto("/configuracion/equipo");
  const invitar = page.getByRole("form", { name: "Invitar al equipo" });
  await invitar.getByLabel("Rol").selectOption("odontologo");
  await invitar.getByLabel("Correo").fill("no-es-correo");
  await invitar.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(invitar.getByText("Escribe un correo válido.")).toBeVisible();
  await expect(invitar.getByText(/necesita su número de colegiatura/)).toBeVisible();

  await invitar.getByLabel("Correo").fill(ASISTENTE);
  await invitar.getByLabel("Nombre").fill("Milagros Invitada");
  await invitar.getByLabel("Rol").selectOption("asistente");
  await invitar.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(page.getByText(`Invitación enviada a ${ASISTENTE}.`, { exact: false })).toBeVisible();
  const fila = page.getByRole("listitem").filter({ hasText: "Milagros Invitada" });
  await expect(fila.getByText(/Invitación pendiente/)).toBeVisible();

  // Ella abre el enlace del correo (en otro navegador), crea su contraseña y entra como asistente
  const enlace = await enlaceDelCorreo(ASISTENTE, /Te invitaron/);
  const contexto = await browser.newContext();
  const ella = await contexto.newPage();
  await ella.goto(enlace);
  // El token se usa solo al pulsar «Continuar» (los antivirus del correo no lo gastan)
  await expect(ella.getByRole("heading", { name: "Bienvenida a tu clínica" })).toBeVisible();
  await ella.getByRole("button", { name: "Continuar" }).click();
  await expect(ella).toHaveURL(/\/cuenta\/clave$/);
  await expect(ella.getByLabel("Contraseña actual")).toHaveCount(0);
  await ella.getByLabel("Contraseña nueva").fill("corta");
  await ella.getByLabel("Repite la contraseña").fill("corta");
  await ella.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(ella.getByText("La contraseña tiene de 8 a 72 caracteres.")).toBeVisible();
  await ella.getByLabel("Contraseña nueva").fill(CLAVE);
  await ella.getByLabel("Repite la contraseña").fill(CLAVE);
  await ella.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(ella).toHaveURL(/\/pacientes/);
  await expect(ella.getByText("Milagros Invitada · Asistente")).toBeVisible();

  // El administrador la desactiva: ya no entra (no se borra nada)
  await page.reload();
  page.once("dialog", (d) => d.accept());
  await fila.getByRole("button", { name: "Desactivar a Milagros Invitada" }).click();
  await expect(fila.getByRole("button", { name: "Reactivar a Milagros Invitada" })).toBeVisible();
  await ella.reload();
  await expect(ella.getByRole("heading", { name: "Sin acceso a una clínica" })).toBeVisible();
  await contexto.close();
});

test("quien olvidó su contraseña la recupera por correo", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await page.getByLabel("Correo").fill(ADMIN);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("te enviamos un enlace");
  await page.goto(await enlaceDelCorreo(ADMIN, /nueva contraseña/));
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/cuenta\/clave$/);
  await page.getByLabel("Contraseña nueva").fill("NuevaClave2026");
  await page.getByLabel("Repite la contraseña").fill("NuevaClave2026");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/\/pacientes/);
  // Fuera del enlace del correo, cambiarla pide la contraseña actual
  await page.goto("/cuenta/clave");
  await page.getByLabel("Contraseña actual").fill("equivocada1");
  await page.getByLabel("Contraseña nueva").fill("OtraClave2026");
  await page.getByLabel("Repite la contraseña").fill("OtraClave2026");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("La contraseña actual no es correcta.")).toBeVisible();
  await page.goto("/pacientes");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await ingresar(page, ADMIN, "NuevaClave2026");
});
