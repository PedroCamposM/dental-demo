# Dental Demo

Demo de software dental centrado en el **plan de tratamiento**. Ver [`CLAUDE.md`](./CLAUDE.md) para el alcance y las reglas,
y [`docs/estado-del-proyecto.md`](./docs/estado-del-proyecto.md) para el estado actual, las decisiones tomadas y lo pendiente.

## Stack

Next.js (App Router) + TypeScript estricto + Tailwind · Supabase (Postgres, Auth, RLS) · Vercel.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar URL y publishable key de Supabase
npm run dev
```

## Integración continua y migraciones

- **CI** (`.github/workflows/ci.yml`, en cada push): lint, tipos, Vitest y build; luego
  levanta **Supabase local real** (`supabase start`), aplica migraciones + seed, corre
  los tests SQL (`scripts/test-db-supabase.sh`) y Playwright contra esa base.
- **Aplicar migraciones al remoto** (`.github/workflows/migrar.yml`, manual): Actions →
  *Aplicar migraciones* → *Run workflow* → escribir `APLICAR`. Primero hace el respaldo
  (`supabase db dump` de esquema, datos y roles, guardado como artefacto por 90 días);
  si falla, no aplica nada. Luego conteos antes, `db push`, verificaciones de
  `supabase/verificaciones/2*.sql` y conteos después.
  Secretos necesarios en GitHub: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` y
  `BACKUP_PASSPHRASE` (16+ caracteres; guárdala también fuera de GitHub). El respaldo se
  sube **cifrado** (`respaldo.tar.gz.gpg`). Para abrirlo:
  `gpg -d respaldo.tar.gz.gpg | tar -xz`.
- Producción sale de `main`; las ramas tienen vista previa en Vercel.

## Despliegue en Vercel

1. Importar el repo en Vercel (Framework Preset: Next.js, sin cambios de build).
2. En **Environments → Production → Branch Tracking**, apuntar a la rama que se quiere publicar.
3. Variables de entorno para **Production and Preview**, de tipo **Config** (no Secret:
   el prefijo `NEXT_PUBLIC_` las envía al navegador y Vercel no permite que sean secretas):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Para probar la versión publicada: `E2E_BASE_URL=https://dental-demo-sigma.vercel.app npm run test:e2e`.
5. Cada push a la rama vuelve a desplegar. Las pruebas no corren en Vercel: correr
   `npm run lint`, `npm test`, `npm run test:db` y `npm run test:e2e` antes de subir.

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
| `…0800_seguimiento_no_show` | tipo de seguimiento `no_show` para escribir a quien faltó a su cita |

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
`supabase/tests/seed.check.sql` que estén los casos que necesita el Tablero de gestión.

## Tablero de gestión

La portada (`/`) lleva a cada usuario a **Pacientes**: la atención clínica va primero.
El Tablero de gestión (`/gestion`, para admin, odontólogo y recepción; no para el
asistente) muestra seis indicadores: primero cuántos pacientes o tratamientos necesitan
seguimiento y, debajo, el monto. Cada uno abre `/gestion/<indicador>` (los enlaces
viejos `/riesgo/<indicador>` redirigen) con la lista de pacientes y un botón **Enviar
mensaje**: arma el texto desde la plantilla de la clínica (editable antes de enviar),
abre WhatsApp con un enlace `wa.me` y registra el envío en `seguimiento`.

Los cálculos están en `src/lib/tablero/calculos.ts` (funciones puras con tests):

| Indicador | Cómo se calcula |
| --- | --- |
| Presentado vs. aceptado | Planes presentados / aceptados desde el 1 del mes (Lima). Las alternativas A/B del mismo día cuentan una vez, por la de mayor valor |
| Presupuestos abiertos | Planes propuestos, del más antiguo al más nuevo; se marcan los vencidos |
| Tratamientos detenidos | Regla 4; vale lo que falta hacer (ítems aceptados o programados) |
| Cuotas vencidas | Saldo de cuotas con vencimiento anterior a hoy, agrupado por paciente |
| Controles vencidos | Controles con fecha pasada, sin resultado "agendó cita" ni cita futura; uno por paciente |
| No-show del mes | Citas "no asistió" del mes sobre las citas ya ocurridas (atendidas + no asistió) |


## Plantillas de mensajes

`/plantillas` permite editar el texto de cada tipo de mensaje (presupuesto,
tratamiento detenido, cuotas vencidas, control y no-show) con vista previa. Las
variables disponibles para cada tipo están en `src/lib/plantillas.ts`; no se guarda
una plantilla con variables que ese mensaje no llena.

## Datos de demo (`supabase/seed.sql`)

Crea **Clínica Dental Demo – Trujillo** con 3 odontólogos, recepción y 120 pacientes
ficticios. Las fechas se calculan desde hoy, así el Tablero de gestión siempre tiene casos vigentes:
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
