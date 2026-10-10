import { expect, test } from "@playwright/test";
import { conEtapa1 } from "./ayudantes";

// Necesita un Supabase con el seed cargado: el remoto (.env.local) o el local
// del CI (supabase start). Sin eso, el login no tiene contra quién autenticarse.
test.skip(
  !process.env.NEXT_PUBLIC_SUPABASE_URL,
  "Requiere NEXT_PUBLIC_SUPABASE_URL y la publishable key de un Supabase con el seed",
);

const PASSWORD = "DemoTrujillo2026";

test("contraseña incorrecta muestra un error claro", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("recepcion@clinica-demo.example");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar" }).click();
  // Next.js tiene su propio role="alert" (anunciador de rutas): se filtra por el texto.
  await expect(page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos." })).toBeVisible();
});

for (const [email, nombre, rol] of [
  ["valverde@clinica-demo.example", "Dra. Lucía Valverde Ríos", "Administrador"],
  ["alvarado@clinica-demo.example", "Dr. Martín Alvarado Cruz", "Odontólogo"],
  ["asistente@clinica-demo.example", "Milagros Ruiz Arana", "Asistente"],
  ["recepcion@clinica-demo.example", "Rosa Chávez Liñán", "Recepción"],
] as const) {
  test(`${rol} entra, ve su clínica y cierra sesión`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar" }).click();

    // Todos empiezan en Pacientes; sin ese módulo, en Gestión (el asistente, en un aviso).
    if (!conEtapa1 && rol === "Asistente") {
      await expect(page.getByRole("heading", { name: "Aún no hay pantallas para tu rol" })).toBeVisible();
    } else {
      await expect(page).toHaveURL(conEtapa1 ? /\/pacientes$/ : /\/gestion$/);
      await expect(page.getByText("Clínica Dental Demo – Trujillo")).toBeVisible();
      await expect(page.getByText(`${nombre} · ${rol}`)).toBeVisible();
      await expect(page.getByText(/dinero en riesgo/i)).toHaveCount(0);
      // El Tablero de gestión es para admin, odontólogo y recepción
      await expect(page.getByRole("link", { name: "Gestión" })).toHaveCount(rol === "Asistente" ? 0 : 1);
    }

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
}

test("el tablero de gestión abre la lista de cuotas vencidas con el mensaje listo para WhatsApp", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("recepcion@clinica-demo.example");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await page.getByRole("link", { name: "Gestión" }).click();
  await expect(page.getByRole("heading", { name: "Tablero de gestión" })).toBeVisible();
  await page.getByRole("link", { name: /Cuotas vencidas/ }).click();
  await expect(page.getByRole("heading", { name: "Cuotas vencidas" })).toBeVisible();

  await page.getByRole("button", { name: "Enviar mensaje" }).first().click();
  await expect(page.getByLabel(/Mensaje/)).toHaveValue(/Clínica Dental Demo – Trujillo[\s\S]*cuota/);
});

test("las plantillas se editan con vista previa y no se guardan con variables inválidas", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("valverde@clinica-demo.example");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("link", { name: "Plantillas" }).click();

  const control = page.getByRole("region", { name: "Control vencido" });
  const mensaje = control.getByLabel("Mensaje");
  const original = await mensaje.inputValue();

  await mensaje.fill("Hola {{nombre}}, le debe {{monto}}");
  await expect(control.getByText("Variables que no existen para este mensaje: {{monto}}.")).toBeVisible();
  await expect(control.getByRole("button", { name: "Guardar" })).toBeDisabled();

  await mensaje.fill("Hola {{nombre}}, ya le toca su control.");
  await expect(control.getByText("Hola María, ya le toca su control.")).toBeVisible();
  await control.getByRole("button", { name: "Guardar" }).click();
  await expect(control.getByRole("status")).toHaveText("Plantilla guardada");

  // Deja la plantilla como estaba
  await mensaje.fill(original);
  await control.getByRole("button", { name: "Guardar" }).click();
  await expect(control.getByRole("status")).toHaveText("Plantilla guardada");
});

test("cerrar sesión en un dispositivo no cierra la del mismo usuario en otro", async ({ browser }) => {
  const entrar = async () => {
    const contexto = await browser.newContext();
    const pagina = await contexto.newPage();
    await pagina.goto("/login");
    await pagina.getByLabel("Correo").fill("mendoza@clinica-demo.example");
    await pagina.getByLabel("Contraseña").fill(PASSWORD);
    await pagina.getByRole("button", { name: "Ingresar" }).click();
    await expect(pagina.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    return pagina;
  };
  const equipo1 = await entrar();
  const equipo2 = await entrar();

  await equipo1.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(equipo1).toHaveURL(/\/login$/);

  // Los enlaces viejos de la v1 (/riesgo/…) llevan al Tablero de gestión
  await equipo2.goto("/riesgo/cuotas");
  await expect(equipo2).toHaveURL(/\/gestion\/cuotas$/);
  await expect(equipo2.getByRole("heading", { name: "Cuotas vencidas" })).toBeVisible();
});

test("el asistente no entra al Tablero de gestión ni a sus listas", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("asistente@clinica-demo.example");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  for (const ruta of ["/gestion", "/gestion/cuotas"]) {
    await page.goto(ruta);
    await expect(page).not.toHaveURL(/\/gestion/);
    await expect(page.getByText("Cuotas vencidas")).toHaveCount(0);
  }
});
