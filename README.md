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

Las migraciones viven en `supabase/migrations/`. La propuesta de esquema está en
[`docs/propuesta-esquema.sql`](./docs/propuesta-esquema.sql) y **no se aplica hasta ser aprobada**.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
