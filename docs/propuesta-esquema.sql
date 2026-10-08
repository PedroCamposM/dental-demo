-- =============================================================================
-- PROPUESTA de esquema inicial — NO APLICAR hasta aprobación.
-- Este archivo vive en docs/ (no en supabase/migrations/) a propósito, para que
-- `supabase db push` no lo ejecute. Una vez aprobado se moverá a una migración.
--
-- Principios:
--   * clinica = tenant. Toda tabla lleva clinica_id y tiene RLS activado.
--   * FKs compuestas (clinica_id, id) impiden mezclar filas de dos clínicas.
--   * Montos en céntimos (integer). Fechas de agenda en timestamptz; la UI
--     muestra America/Lima.
--   * Datos clínicos y pagos no se borran: no hay GRANT DELETE; se anulan
--     (anulado_at / anulado_por / motivo_anulacion) y la auditoría lo registra.
--   * anon no recibe ningún permiso. authenticated recibe GRANTs explícitos
--     y RLS filtra por clínica y rol.
-- =============================================================================

create schema if not exists privado;   -- no expuesto por la Data API
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.rol_usuario        as enum ('admin', 'odontologo', 'recepcion');
create type public.tipo_odontograma   as enum ('inicial', 'evolucion');
create type public.estado_plan        as enum ('propuesto', 'aceptado', 'en_curso', 'detenido', 'terminado', 'rechazado');
create type public.estado_item        as enum ('propuesto', 'aceptado', 'programado', 'realizado', 'cobrado');
create type public.estado_cita        as enum ('programada', 'confirmada', 'atendida', 'no_asistio', 'cancelada');
create type public.metodo_pago        as enum ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia');
create type public.tipo_seguimiento   as enum ('presupuesto', 'tratamiento_detenido', 'cuota_vencida', 'control');
create type public.resultado_seguimiento as enum ('pendiente', 'mensaje_enviado', 'contactado', 'no_contesta', 'agendo_cita', 'rechazo', 'pago');

-- ---------------------------------------------------------------------------
-- Tenant y usuarios
-- ---------------------------------------------------------------------------
create table public.clinica (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  ruc         text check (ruc ~ '^\d{11}$'),
  zona_horaria text not null default 'America/Lima',
  created_at  timestamptz not null default now()
);

create table public.usuario (
  id          uuid primary key references auth.users (id),
  clinica_id  uuid not null references public.clinica (id),
  nombre      text not null,
  rol         public.rol_usuario not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (clinica_id, id)
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

revoke all on function privado.clinica_actual(), privado.rol_actual() from public, anon;
grant execute on function privado.clinica_actual(), privado.rol_actual() to authenticated;

-- ---------------------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------------------
create table public.paciente (
  id                    uuid primary key default gen_random_uuid(),
  clinica_id            uuid not null references public.clinica (id),
  dni                   text check (dni ~ '^\d{8}$'),
  nombres               text not null,
  apellidos             text not null,
  telefono              text,            -- formato E.164 sin '+', p. ej. 51987654321 (para wa.me)
  fecha_nacimiento      date,
  apoderado_nombre      text,
  apoderado_dni         text check (apoderado_dni ~ '^\d{8}$'),
  apoderado_telefono    text,
  consentimiento_datos_at timestamptz,   -- fecha del consentimiento (Ley 29733)
  anulado_at            timestamptz,
  anulado_por           uuid references public.usuario (id),
  motivo_anulacion      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (clinica_id, id),
  unique (clinica_id, dni),
  constraint paciente_anulacion_completa check (
    (anulado_at is null) = (motivo_anulacion is null)
  )
);
-- "Menor de edad => apoderado obligatorio" se valida en la lógica (Vitest):
-- un CHECK con current_date no es inmutable y rompería dumps/restores.

-- ---------------------------------------------------------------------------
-- Odontograma (nomenclatura NTS 188-MINSA/DGIESP-2022)
-- PENDIENTE: catálogo de hallazgos, símbolos y colores. NO se inventan:
-- hallazgo_codigo y superficie quedan como texto libre hasta recibir la norma.
-- ---------------------------------------------------------------------------
create table public.odontograma (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null,
  paciente_id    uuid not null,
  tipo           public.tipo_odontograma not null,
  fecha          timestamptz not null default now(),
  odontologo_id  uuid not null,
  observaciones  text,
  anulado_at     timestamptz,
  anulado_por    uuid references public.usuario (id),
  motivo_anulacion text,
  created_at     timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)   references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id) references public.usuario (clinica_id, id)
);

create table public.odontograma_hallazgo (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  odontograma_id  uuid not null,
  pieza           smallint not null check (
    (pieza / 10 between 1 and 4 and pieza % 10 between 1 and 8)   -- permanentes FDI
    or (pieza / 10 between 5 and 8 and pieza % 10 between 1 and 5) -- deciduas FDI
  ),
  superficie      text,               -- pendiente de catálogo NTS 188
  hallazgo_codigo text not null,      -- pendiente de catálogo NTS 188
  cie10           text check (cie10 ~ '^[A-Z]\d{2}(\.\d{1,2})?$'),
  nota            text,
  anulado_at      timestamptz,
  anulado_por     uuid references public.usuario (id),
  motivo_anulacion text,
  created_at      timestamptz not null default now(),
  foreign key (clinica_id, odontograma_id) references public.odontograma (clinica_id, id)
);

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
  plan_origen_id     uuid,            -- versión anterior de la que deriva
  version            smallint not null default 1 check (version >= 1),
  alternativa        char(1) not null default 'A' check (alternativa ~ '^[A-Z]$'),
  estado             public.estado_plan not null default 'propuesto',
  motivo_rechazo     text,
  presentado_at      timestamptz not null default now(),
  fecha_vencimiento  date,            -- vigencia del presupuesto
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

create table public.nota_evolucion (
  id             uuid primary key default gen_random_uuid(),
  clinica_id     uuid not null,
  paciente_id    uuid not null,
  odontologo_id  uuid not null,
  texto          text not null,
  cie10          text check (cie10 ~ '^[A-Z]\d{2}(\.\d{1,2})?$'),
  fecha          timestamptz not null default now(),
  anulado_at     timestamptz,
  anulado_por    uuid references public.usuario (id),
  motivo_anulacion text,
  created_at     timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)   references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id) references public.usuario (clinica_id, id)
);

create table public.cuota (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null,
  plan_id           uuid not null,
  numero            smallint not null check (numero >= 1),
  monto_centimos    integer not null check (monto_centimos > 0),
  vence_el          date not null,
  created_at        timestamptz not null default now(),
  unique (clinica_id, id),
  unique (plan_id, numero),
  foreign key (clinica_id, plan_id) references public.plan_tratamiento (clinica_id, id)
);

create table public.pago (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  plan_id          uuid not null,
  cuota_id         uuid,
  monto_centimos   integer not null check (monto_centimos > 0),
  metodo           public.metodo_pago not null,
  pagado_at        timestamptz not null default now(),
  referencia       text,              -- nº de operación Yape/Plin/transferencia
  registrado_por   uuid not null,
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, plan_id)        references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, cuota_id)       references public.cuota (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id)
);

create table public.item_plan (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null,
  plan_id            uuid not null,
  pieza              smallint check (
    pieza is null
    or (pieza / 10 between 1 and 4 and pieza % 10 between 1 and 8)
    or (pieza / 10 between 5 and 8 and pieza % 10 between 1 and 5)
  ),
  superficie         text,
  procedimiento      text not null,
  cie10              text check (cie10 ~ '^[A-Z]\d{2}(\.\d{1,2})?$'),
  precio_centimos    integer not null check (precio_centimos >= 0),
  odontologo_id      uuid not null,
  estado             public.estado_item not null default 'propuesto',
  nota_evolucion_id  uuid,
  pago_id            uuid,
  realizado_at       timestamptz,
  orden              smallint not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, plan_id)           references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, odontologo_id)     references public.usuario (clinica_id, id),
  foreign key (clinica_id, nota_evolucion_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, pago_id)           references public.pago (clinica_id, id),
  -- Regla 1: realizado => nota de evolución; cobrado => pago asociado
  constraint item_realizado_con_nota check (estado <> 'realizado' or nota_evolucion_id is not null),
  constraint item_cobrado_con_pago   check (estado <> 'cobrado'   or pago_id is not null)
);

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
  mensaje_enviado   text,             -- texto final enviado por wa.me
  realizado_at      timestamptz,
  realizado_por     uuid references public.usuario (id),
  created_at        timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)  references public.paciente (clinica_id, id),
  foreign key (clinica_id, plan_id)      references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, cuota_id)     references public.cuota (clinica_id, id),
  foreign key (clinica_id, plantilla_id) references public.plantilla_mensaje (clinica_id, id)
);

-- ---------------------------------------------------------------------------
-- Auditoría (solo la escriben triggers)
-- ---------------------------------------------------------------------------
create table public.auditoria (
  id          bigint generated always as identity primary key,
  clinica_id  uuid not null references public.clinica (id),
  tabla       text not null,
  registro_id uuid not null,
  accion      text not null check (accion in ('insert', 'update', 'anular')),
  usuario_id  uuid,                   -- auth.uid() al momento del cambio
  antes       jsonb,
  despues     jsonb,
  ocurrido_at timestamptz not null default now()
);

create function privado.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_accion text := lower(tg_op);
begin
  if tg_op = 'UPDATE' and old.anulado_at is null and new.anulado_at is not null then
    v_accion := 'anular';
  end if;
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (new.clinica_id, tg_table_name, new.id, v_accion, auth.uid(),
          case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
-- Variante sin columna anulado_at (plan, ítem, cuota, cita): solo insert/update.
create function privado.auditar_simple() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (new.clinica_id, tg_table_name, new.id, lower(tg_op), auth.uid(),
          case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;

create trigger auditar after insert or update on public.paciente             for each row execute function privado.auditar();
create trigger auditar after insert or update on public.odontograma          for each row execute function privado.auditar();
create trigger auditar after insert or update on public.odontograma_hallazgo for each row execute function privado.auditar();
create trigger auditar after insert or update on public.nota_evolucion       for each row execute function privado.auditar();
create trigger auditar after insert or update on public.pago                 for each row execute function privado.auditar();
create trigger auditar after insert or update on public.plan_tratamiento     for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.item_plan            for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.cuota                for each row execute function privado.auditar_simple();

-- ---------------------------------------------------------------------------
-- Reglas de negocio en la base
-- ---------------------------------------------------------------------------
-- Regla 3: al terminar un plan se crea un seguimiento de control.
create function privado.crear_control_al_terminar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'terminado' and old.estado is distinct from 'terminado' then
    new.terminado_at := coalesce(new.terminado_at, now());
    insert into public.seguimiento (clinica_id, paciente_id, plan_id, tipo, fecha_programada)
    values (new.clinica_id, new.paciente_id, new.id, 'control',
            ((new.terminado_at at time zone 'America/Lima')::date + interval '6 months')::date);
  end if;
  return new;
end $$;
create trigger control_al_terminar before update of estado on public.plan_tratamiento
  for each row execute function privado.crear_control_al_terminar();

-- Regla 4: plan detenido = ítems aceptados sin realizar y sin cita en 30 días.
-- Se calcula (vista) en lugar de depender de que alguien cambie el estado a mano.
create view public.v_plan_detenido with (security_invoker = true) as
select p.id as plan_id, p.clinica_id, p.paciente_id,
       sum(i.precio_centimos)::bigint as valor_pendiente_centimos
from public.plan_tratamiento p
join public.item_plan i on i.plan_id = p.id and i.estado in ('aceptado', 'programado')
where p.estado in ('aceptado', 'en_curso', 'detenido')
  and not exists (
    select 1 from public.cita_item ci
    join public.cita c on c.id = ci.cita_id
    where ci.item_plan_id = i.id
      and c.estado in ('programada', 'confirmada')
      and c.inicio between now() and now() + interval '30 days'
  )
group by p.id, p.clinica_id, p.paciente_id;

-- updated_at
create function privado.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger updated_at before update on public.paciente          for each row execute function privado.tocar_updated_at();
create trigger updated_at before update on public.plan_tratamiento  for each row execute function privado.tocar_updated_at();
create trigger updated_at before update on public.item_plan         for each row execute function privado.tocar_updated_at();
create trigger updated_at before update on public.cita              for each row execute function privado.tocar_updated_at();
create trigger updated_at before update on public.plantilla_mensaje for each row execute function privado.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- Índices (clinica_id + FKs más consultadas por el tablero)
-- ---------------------------------------------------------------------------
create index on public.usuario (clinica_id);
create index on public.paciente (clinica_id, apellidos);
create index on public.odontograma (paciente_id);
create index on public.odontograma_hallazgo (odontograma_id);
create index on public.plan_tratamiento (clinica_id, estado, presentado_at);
create index on public.plan_tratamiento (paciente_id);
create index on public.item_plan (plan_id, estado);
create index on public.nota_evolucion (paciente_id);
create index on public.cuota (clinica_id, vence_el);
create index on public.pago (plan_id);
create index on public.pago (cuota_id);
create index on public.cita (clinica_id, inicio);
create index on public.cita (paciente_id);
create index on public.cita_item (item_plan_id);
create index on public.seguimiento (clinica_id, resultado, fecha_programada);
create index on public.auditoria (clinica_id, tabla, registro_id);

-- ---------------------------------------------------------------------------
-- RLS
-- Patrón: (select privado.clinica_actual()) se evalúa una vez por consulta.
-- ---------------------------------------------------------------------------
alter table public.clinica              enable row level security;
alter table public.usuario              enable row level security;
alter table public.paciente             enable row level security;
alter table public.odontograma          enable row level security;
alter table public.odontograma_hallazgo enable row level security;
alter table public.plan_tratamiento     enable row level security;
alter table public.nota_evolucion       enable row level security;
alter table public.cuota                enable row level security;
alter table public.pago                 enable row level security;
alter table public.item_plan            enable row level security;
alter table public.cita                 enable row level security;
alter table public.cita_item            enable row level security;
alter table public.plantilla_mensaje    enable row level security;
alter table public.seguimiento          enable row level security;
alter table public.auditoria            enable row level security;

-- clinica: ver la propia; solo admin edita
create policy clinica_select on public.clinica for select to authenticated
  using (id = (select privado.clinica_actual()));
create policy clinica_update on public.clinica for update to authenticated
  using (id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (id = (select privado.clinica_actual()));

-- usuario: todos ven a su equipo; solo admin crea/edita (incluido el rol)
create policy usuario_select on public.usuario for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy usuario_insert on public.usuario for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');
create policy usuario_update on public.usuario for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (clinica_id = (select privado.clinica_actual()));

-- Tablas de toda la clínica (todos los roles leen y escriben)
do $$
declare t text;
begin
  foreach t in array array['paciente', 'plan_tratamiento', 'item_plan', 'cuota',
                           'cita', 'cita_item', 'seguimiento', 'plantilla_mensaje']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (clinica_id = (select privado.clinica_actual()));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (clinica_id = (select privado.clinica_actual()));
      create policy %1$s_update on public.%1$I for update to authenticated
        using (clinica_id = (select privado.clinica_actual()))
        with check (clinica_id = (select privado.clinica_actual()));
    $f$, t);
  end loop;
end $$;

-- Datos clínicos: solo admin y odontólogo (recepción no ve odontograma ni notas)
do $$
declare t text;
begin
  foreach t in array array['odontograma', 'odontograma_hallazgo', 'nota_evolucion']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (clinica_id = (select privado.clinica_actual())
               and (select privado.rol_actual()) in ('admin', 'odontologo'));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (clinica_id = (select privado.clinica_actual())
                    and (select privado.rol_actual()) in ('admin', 'odontologo'));
      create policy %1$s_update on public.%1$I for update to authenticated
        using (clinica_id = (select privado.clinica_actual())
               and (select privado.rol_actual()) in ('admin', 'odontologo'))
        with check (clinica_id = (select privado.clinica_actual()));
    $f$, t);
  end loop;
end $$;

create policy cita_item_delete on public.cita_item for delete to authenticated
  using (clinica_id = (select privado.clinica_actual()));

-- Pagos: todos leen; registran/anulan admin y recepción
create policy pago_select on public.pago for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy pago_insert on public.pago for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual())
              and (select privado.rol_actual()) in ('admin', 'recepcion'));
create policy pago_update on public.pago for update to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) in ('admin', 'recepcion'))
  with check (clinica_id = (select privado.clinica_actual()));

-- Auditoría: solo lectura para admin; escritura solo vía triggers
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');

-- ---------------------------------------------------------------------------
-- GRANTs explícitos (no dependemos de los default privileges)
-- Sin DELETE salvo cita_item: los registros se anulan, no se borran.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema privado from public, anon;

grant usage on schema public to authenticated;

grant select, update                 on public.clinica              to authenticated;
grant select, insert, update         on public.usuario              to authenticated;
grant select, insert, update         on public.paciente             to authenticated;
grant select, insert, update         on public.odontograma          to authenticated;
grant select, insert, update         on public.odontograma_hallazgo to authenticated;
grant select, insert, update         on public.plan_tratamiento     to authenticated;
grant select, insert, update         on public.nota_evolucion       to authenticated;
grant select, insert, update         on public.cuota                to authenticated;
grant select, insert, update         on public.pago                 to authenticated;
grant select, insert, update         on public.item_plan            to authenticated;
grant select, insert, update         on public.cita                 to authenticated;
grant select, insert, delete         on public.cita_item            to authenticated;  -- desvincular ítem de una cita (no es dato clínico)
grant select, insert, update         on public.plantilla_mensaje    to authenticated;
grant select, insert, update         on public.seguimiento          to authenticated;
grant select                         on public.auditoria            to authenticated;
grant select                         on public.v_plan_detenido      to authenticated;

-- Las columnas de identidad/tenant no se reescriben en un UPDATE
revoke update on public.usuario from authenticated;
grant update (nombre, rol, activo) on public.usuario to authenticated;
