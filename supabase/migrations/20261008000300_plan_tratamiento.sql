-- Plan de tratamiento, notas de evolución e ítems
-- Origen: docs/propuesta-esquema.sql (v2, aprobada).

-- ---------------------------------------------------------------------------
-- Plan de tratamiento (núcleo)
-- version: 1, 2, 3… del mismo plan; alternativa: 'A', 'B'… presentadas a la vez.
-- ---------------------------------------------------------------------------
create table public.plan_tratamiento (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null,
  paciente_id        uuid not null,
  odontologo_id      uuid not null,
  titulo             text not null,
  plan_origen_id     uuid,
  version            smallint not null default 1 check (version >= 1),
  alternativa        char(1) not null default 'A' check (alternativa ~ '^[A-Z]$'),
  estado             public.estado_plan not null default 'propuesto',
  motivo_rechazo     text,
  presentado_at      timestamptz not null default now(),
  fecha_vencimiento  date,
  aceptado_at        timestamptz,
  terminado_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)    references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id)  references public.usuario (clinica_id, id),
  foreign key (clinica_id, plan_origen_id) references public.plan_tratamiento (clinica_id, id),
  constraint plan_rechazo_con_motivo check (estado <> 'rechazado' or motivo_rechazo is not null)
);

alter table public.odontograma
  add foreign key (clinica_id, plan_id) references public.plan_tratamiento (clinica_id, id);

create table public.nota_evolucion (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  odontologo_id    uuid not null,
  texto            text not null,
  cie10            text check (cie10 ~ '^[A-Z]\d{2}(\.\d{1,2})?$'),
  fecha            timestamptz not null default now(),
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)   references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id) references public.usuario (clinica_id, id),
  constraint nota_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null))
);

create table public.item_plan (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null,
  plan_id            uuid not null,
  pieza              smallint check (pieza is null or privado.es_pieza_fdi(pieza)),
  superficies        text[] check (superficies <@ array['vestibular', 'palatino', 'lingual', 'mesial', 'distal', 'oclusal', 'incisal']),
  procedimiento      text not null,
  cie10              text check (cie10 ~ '^[A-Z]\d{2}(\.\d{1,2})?$'),
  precio_centimos    integer not null check (precio_centimos >= 0),
  odontologo_id      uuid not null,
  estado             public.estado_item not null default 'propuesto',
  nota_evolucion_id  uuid,
  realizado_at       timestamptz,
  motivo_cancelacion text,
  orden              smallint not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, plan_id)           references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, odontologo_id)     references public.usuario (clinica_id, id),
  foreign key (clinica_id, nota_evolucion_id) references public.nota_evolucion (clinica_id, id),
  -- Regla 1a: realizado => nota de evolución (la regla 1b, cobrado => pago, se cumple
  -- por construcción: "cobrado" se calcula desde pago_aplicacion)
  constraint item_realizado_con_nota check (estado <> 'realizado' or (nota_evolucion_id is not null and realizado_at is not null)),
  constraint item_cancelado_con_motivo check (estado <> 'cancelado' or motivo_cancelacion is not null)
);

-- Solo un cirujano dentista marca "realizado", con una nota del mismo paciente.
-- Un ítem realizado no vuelve atrás.
create function privado.validar_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.estado = 'realizado' and new.estado <> 'realizado' then
    raise exception 'Un ítem realizado no puede cambiar de estado';
  end if;
  if new.estado = 'realizado' and (tg_op = 'INSERT' or old.estado <> 'realizado') then
    if not privado.es_dentista() then
      raise exception 'Solo un cirujano dentista puede marcar un ítem como realizado';
    end if;
    if not exists (
      select 1 from public.nota_evolucion n
      join public.plan_tratamiento p on p.id = new.plan_id
      where n.id = new.nota_evolucion_id and n.paciente_id = p.paciente_id and n.anulado_at is null
    ) then
      raise exception 'La nota de evolución debe ser del mismo paciente y estar vigente';
    end if;
  end if;
  return new;
end $$;
create trigger validar before insert or update on public.item_plan
  for each row execute function privado.validar_item();

-- RLS activado desde el inicio: sin políticas, nadie lee ni escribe.
alter table public.plan_tratamiento enable row level security;
alter table public.nota_evolucion enable row level security;
alter table public.item_plan enable row level security;
