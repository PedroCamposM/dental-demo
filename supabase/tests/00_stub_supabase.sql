-- Imitación mínima de lo que Supabase trae de fábrica, para probar las
-- migraciones en un Postgres local (scripts/test-db.sh). NO es una migración.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema extensions;
create extension pgcrypto with schema extensions;

create schema auth;
-- Solo las columnas que usan las pruebas y supabase/seed.sql
create table auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text
);
create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users (id),
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  unique (provider_id, provider)
);
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Como en Supabase: lo creado en public es visible por la Data API salvo que se revoque.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
