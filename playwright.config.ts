import { defineConfig, devices } from "@playwright/test";

// PLAYWRIGHT_CHROMIUM_PATH permite usar un Chromium ya instalado (p. ej. en CI
// o en un contenedor) en lugar del que descarga `npx playwright install`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const port = Number(process.env.PORT_E2E ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "es-PE",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Valores de relleno si no hay .env.local: las pruebas de humo no llaman a Supabase.
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_e2e",
    },
  },
});
