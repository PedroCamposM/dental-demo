-- Esquema privado, tipos, clínica (tenant), usuarios y pacientes
-- Origen: docs/propuesta-esquema.sql (v2, aprobada).

create schema if not exists privado;   -- no expuesto por la Data API
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.rol_usuario        as enum ('admin', 'odontologo', 'recepcion');
create type public.tipo_odontograma   as enum ('inicial', 'evolucion');
create type public.estado_hallazgo    as enum ('bueno', 'malo');   -- azul / rojo (5.12, 5.13)
create type public.estado_plan        as enum ('propuesto', 'aceptado', 'en_curso', 'detenido', 'terminado', 'rechazado');
create type public.estado_item        as enum ('propuesto', 'aceptado', 'programado', 'realizado', 'cancelado');
create type public.estado_cita        as enum ('programada', 'confirmada', 'atendida', 'no_asistio', 'cancelada');
create type public.metodo_pago        as enum ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia');
create type public.tipo_seguimiento   as enum ('presupuesto', 'tratamiento_detenido', 'cuota_vencida', 'control');
create type public.resultado_seguimiento as enum ('pendiente', 'mensaje_enviado', 'contactado', 'no_contesta', 'agendo_cita', 'rechazo', 'pago');

-- ---------------------------------------------------------------------------
-- Tenant y usuarios
-- ---------------------------------------------------------------------------
create table public.clinica (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  ruc          text check (ruc ~ '^\d{11}$'),
  zona_horaria text not null default 'America/Lima',
  created_at   timestamptz not null default now()
);

create table public.usuario (
  id          uuid primary key references auth.users (id),
  clinica_id  uuid not null references public.clinica (id),
  nombre      text not null,
  rol         public.rol_usuario not null,
  cop         text check (cop ~ '^\d{1,6}$'),   -- Colegio Odontológico del Perú; habilita el registro clínico
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (clinica_id, id),
  constraint odontologo_con_cop check (rol <> 'odontologo' or cop is not null)
);

-- Helpers para RLS. SECURITY DEFINER para no recursar en las políticas de usuario.
create function privado.clinica_actual() returns uuid
language sql stable security definer set search_path = '' as $$
  select clinica_id from public.usuario where id = auth.uid() and activo
$$;

create function privado.rol_actual() returns public.rol_usuario
language sql stable security definer set search_path = '' as $$
  select rol from public.usuario where id = auth.uid() and activo
$$;

-- Cirujano dentista = admin u odontólogo con COP (firma el registro clínico, 5.3)
create function privado.es_dentista() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select rol in ('admin', 'odontologo') and cop is not null
                   from public.usuario where id = auth.uid() and activo), false)
$$;

-- Siempre debe quedar al menos un admin activo en la clínica.
create function privado.validar_admin_restante() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.rol = 'admin' and old.activo and (new.rol <> 'admin' or not new.activo) then
    perform 1 from public.usuario where clinica_id = old.clinica_id for update;
    if not exists (select 1 from public.usuario
                   where clinica_id = old.clinica_id and id <> old.id
                     and rol = 'admin' and activo) then
      raise exception 'La clínica debe conservar al menos un administrador activo';
    end if;
  end if;
  return new;
end $$;
create trigger admin_restante before update of rol, activo on public.usuario
  for each row execute function privado.validar_admin_restante();

-- ---------------------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------------------
create table public.paciente (
  id                      uuid primary key default gen_random_uuid(),
  clinica_id              uuid not null references public.clinica (id),
  dni                     text check (dni ~ '^\d{8}$'),
  nombres                 text not null,
  apellidos               text not null,
  telefono                text check (telefono ~ '^51\d{9}$'),   -- E.164 sin '+', listo para wa.me
  fecha_nacimiento        date,
  apoderado_nombre        text,
  apoderado_dni           text check (apoderado_dni ~ '^\d{8}$'),
  apoderado_telefono      text check (apoderado_telefono ~ '^51\d{9}$'),
  consentimiento_datos_at timestamptz,   -- Ley 29733
  anulado_at              timestamptz,
  anulado_por             uuid references public.usuario (id),
  motivo_anulacion        text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (clinica_id, id),
  unique (clinica_id, dni),
  constraint paciente_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null))
);
-- "Menor de edad => apoderado obligatorio" se valida en la lógica (Vitest):
-- un CHECK con current_date no es inmutable y rompería dumps/restores.

-- RLS activado desde el inicio: sin políticas, nadie lee ni escribe.
alter table public.clinica enable row level security;
alter table public.usuario enable row level security;
alter table public.paciente enable row level security;
