# Dental Demo

Demo de software dental centrado en el **plan de tratamiento**. Ver [`CLAUDE.md`](./CLAUDE.md) para el alcance y las reglas.

## Stack

Next.js (App Router) + TypeScript estricto + Tailwind · Supabase (Postgres, Auth, RLS) · Vercel.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar URL y publishable key de Supabase
npm run dev
```

## Supabase CLI (vía npx)

```bash
npx supabase login                          # una vez, abre el navegador o usa SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref elotisuupmqmcedjgxiz
npx supabase migration list                 # ver estado (no aplica nada)
```

Las migraciones viven en `supabase/migrations/` y salen del esquema aprobado en
[`docs/propuesta-esquema.sql`](./docs/propuesta-esquema.sql):

| Migración | Contenido |
| --- | --- |
| `…0100_base_tenant_usuarios_pacientes` | esquema `privado`, tipos, clínica, usuario, paciente |
| `…0200_odontograma_nts188` | catálogo NTS 188 (38 hallazgos), odontograma y validación |
| `…0300_plan_tratamiento` | plan, nota de evolución, ítems (regla 1) |
| `…0400_cuotas_pagos` | cuotas, pagos, `pago_aplicacion`, saldos calculados |
| `…0500_citas_seguimiento` | citas, plantillas de WhatsApp, seguimiento |
| `…0600_auditoria_reglas_indices` | auditoría, reglas 3 y 4, anulación de una vía, índices |
| `…0700_rls_grants` | políticas RLS y GRANTs explícitos |

RLS se activa en la misma migración que crea cada tabla; las políticas llegan en la última.

```bash
npx supabase db push        # aplica las migraciones pendientes al proyecto enlazado
```

### Pruebas de base de datos

`npm run test:db` levanta un Postgres local efímero (binarios en `PGBIN`, por defecto
`/usr/lib/postgresql/16/bin`), aplica las migraciones sobre una imitación mínima de
Supabase (`supabase/tests/00_stub_supabase.sql`) y corre `supabase/tests/*.test.sql`:
aislamiento entre clínicas, permisos por rol, catálogo NTS 188, inalterabilidad,
pagos sin sobreaplicar y reglas 1, 3 y 4.

Después de las pruebas, `test:db` carga `supabase/seed.sql` y verifica con
`supabase/tests/seed.check.sql` que estén los casos que necesita el tablero.

## Datos de demo (`supabase/seed.sql`)

Crea **Clínica Dental Demo – Trujillo** con 3 odontólogos, recepción y 120 pacientes
ficticios. Las fechas se calculan desde hoy, así el tablero siempre tiene casos vigentes:
ortodoncias con cuotas atrasadas, presupuestos de implantes sin respuesta, tratamientos
detenidos, controles vencidos y no-shows del mes. Todo es inventado: nunca usar datos
reales de pacientes.

- Local: `npx supabase db reset` lo carga después de las migraciones.
- Proyecto remoto: se carga una sola vez sobre la base vacía (si la clínica demo ya
  existe, se detiene).

| Usuario | Rol |
| --- | --- |
| `valverde@clinica-demo.example` | admin y odontóloga (rehabilitación e implantes) |
| `alvarado@clinica-demo.example` | odontólogo (ortodoncia) |
| `mendoza@clinica-demo.example` | odontóloga (general y endodoncia) |
| `recepcion@clinica-demo.example` | recepción |

Contraseña de demo para todos: `DemoTrujillo2026`.

> Los teléfonos son números al azar con formato peruano y pueden pertenecer a
> personas reales. En una demo en vivo, cambia el teléfono del paciente que vayas a
> usar por el tuyo antes de pulsar «enviar mensaje».

## Pruebas

- `npm test`: Vitest (lógica en `src/**/*.test.ts`)
- `npm run test:e2e`: Playwright (`e2e/`). Compila y levanta la app en el puerto 3100.
  Las pruebas de login real (`e2e/login.spec.ts`) solo corren si `.env.local` apunta
  al proyecto de Supabase con el seed; si no, se marcan como omitidas.
  Si ya hay un Chromium instalado, `PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium` evita
  descargarlo; si no, `npx playwright install chromium`.
- `npm run test:db`: migraciones, RLS, reglas y seed sobre un Postgres efímero

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` ·
`npm run test:e2e` · `npm run test:db`
