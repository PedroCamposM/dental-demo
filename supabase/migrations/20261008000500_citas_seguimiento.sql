-- Citas, plantillas de mensaje y seguimiento
-- Origen: docs/propuesta-esquema.sql (v2, aprobada).

-- ---------------------------------------------------------------------------
-- Citas (N:M con item_plan)
-- ---------------------------------------------------------------------------
create table public.cita (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null,
  paciente_id    uuid not null,
  odontologo_id  uuid not null,
  inicio         timestamptz not null,
  fin            timestamptz not null,
  estado         public.estado_cita not null default 'programada',
  nota           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)   references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id) references public.usuario (clinica_id, id),
  check (fin > inicio)
);

create table public.cita_item (
  clinica_id    uuid not null,
  cita_id       uuid not null,
  item_plan_id  uuid not null,
  primary key (cita_id, item_plan_id),
  foreign key (clinica_id, cita_id)      references public.cita (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id)
);

-- ---------------------------------------------------------------------------
-- Seguimiento y plantillas de WhatsApp (wa.me)
-- ---------------------------------------------------------------------------
create table public.plantilla_mensaje (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinica (id),
  tipo        public.tipo_seguimiento not null,
  nombre      text not null,
  cuerpo      text not null,          -- con variables {{nombre}}, {{monto}}, …
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinica_id, id)
);

create table public.seguimiento (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null,
  paciente_id       uuid not null,
  plan_id           uuid,
  cuota_id          uuid,
  tipo              public.tipo_seguimiento not null,
  fecha_programada  date not null,
  resultado         public.resultado_seguimiento not null default 'pendiente',
  nota              text,
  plantilla_id      uuid,
  mensaje_enviado   text,
  realizado_at      timestamptz,
  realizado_por     uuid references public.usuario (id),
  created_at        timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)  references public.paciente (clinica_id, id),
  foreign key (clinica_id, plan_id)      references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, cuota_id)     references public.cuota (clinica_id, id),
  foreign key (clinica_id, plantilla_id) references public.plantilla_mensaje (clinica_id, id)
);

-- RLS activado desde el inicio: sin políticas, nadie lee ni escribe.
alter table public.cita enable row level security;
alter table public.cita_item enable row level security;
alter table public.plantilla_mensaje enable row level security;
alter table public.seguimiento enable row level security;
