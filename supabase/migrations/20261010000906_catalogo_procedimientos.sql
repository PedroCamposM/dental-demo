-- Etapa 2 (v2): catálogo de procedimientos y aranceles de la clínica.
-- Aditiva: tabla nueva y una columna opcional en item_plan (los ítems existentes
-- conservan su texto y precio; el plan nuevo de la Etapa 5 tomará el catálogo).

create type public.especialidad as enum (
  'general', 'preventiva', 'operatoria', 'endodoncia', 'periodoncia', 'cirugia',
  'ortodoncia', 'implantes', 'rehabilitacion', 'odontopediatria', 'estetica'
);

create table public.procedimiento (
  id                       uuid primary key default gen_random_uuid(),
  clinica_id               uuid not null references public.clinica (id),
  codigo                   text not null check (codigo ~ '^[A-Z0-9][A-Z0-9-]{1,14}$'),
  nombre                   text not null check (char_length(btrim(nombre)) between 3 and 120),
  especialidad             public.especialidad not null,
  precio_base_centimos     integer not null check (precio_base_centimos between 0 and 10000000),
  duracion_minutos         smallint not null check (duracion_minutos between 5 and 480 and duracion_minutos % 5 = 0),
  requiere_consentimiento  boolean not null default false,
  -- Días después de realizado en que se crea el control automático (null: no genera control)
  control_dias             smallint check (control_dias between 1 and 730),
  activo                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (clinica_id, id),
  unique (clinica_id, codigo)
);
create unique index procedimiento_nombre_unico on public.procedimiento (clinica_id, lower(btrim(nombre)));
alter table public.procedimiento enable row level security;

create trigger updated_at before update on public.procedimiento
  for each row execute function privado.tocar_updated_at();
create trigger auditar after insert or update on public.procedimiento
  for each row execute function privado.auditar_simple();

-- Todo el equipo consulta el catálogo; solo el administrador lo mantiene.
-- No se borra: se desactiva (los planes antiguos pueden apuntar a él).
create policy procedimiento_select on public.procedimiento for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy procedimiento_insert on public.procedimiento for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');
create policy procedimiento_update on public.procedimiento for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (clinica_id = (select privado.clinica_actual()));

-- Supabase da todo a anon/authenticated en las tablas nuevas: se quita y se
-- concede solo lo necesario (regla 8).
revoke all on public.procedimiento from anon, authenticated;
grant select, insert on public.procedimiento to authenticated;
grant update (codigo, nombre, especialidad, precio_base_centimos, duracion_minutos,
              requiere_consentimiento, control_dias, activo)
  on public.procedimiento to authenticated;

-- El ítem del plan puede apuntar al procedimiento del catálogo (precio y duración
-- se copian al ítem y el odontólogo los puede ajustar ahí).
alter table public.item_plan add column procedimiento_id uuid;
alter table public.item_plan
  add constraint item_plan_procedimiento_fk
  foreign key (clinica_id, procedimiento_id) references public.procedimiento (clinica_id, id);
create index item_plan_procedimiento_idx on public.item_plan (procedimiento_id) where procedimiento_id is not null;
