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

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run test:db`
