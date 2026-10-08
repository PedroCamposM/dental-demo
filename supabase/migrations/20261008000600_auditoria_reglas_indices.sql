-- Auditoría, reglas de negocio en la base e índices
-- Origen: docs/propuesta-esquema.sql (v2, aprobada).

-- ---------------------------------------------------------------------------
-- Auditoría (solo la escriben triggers)
-- ---------------------------------------------------------------------------
create table public.auditoria (
  id          bigint generated always as identity primary key,
  clinica_id  uuid not null references public.clinica (id),
  tabla       text not null,
  registro_id uuid not null,
  accion      text not null check (accion in ('insert', 'update', 'anular')),
  usuario_id  uuid,
  antes       jsonb,
  despues     jsonb,
  ocurrido_at timestamptz not null default now()
);

-- Para tablas con columnas de anulación
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
-- Para tablas sin anulación: solo insert/update
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
create trigger auditar after insert            on public.pago_aplicacion     for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.plan_tratamiento     for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.item_plan            for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.cuota                for each row execute function privado.auditar_simple();
create trigger auditar after insert or update on public.usuario              for each row execute function privado.auditar_simple();

-- ---------------------------------------------------------------------------
-- Reglas de negocio en la base
-- ---------------------------------------------------------------------------
-- Regla 3: al terminar un plan se crea un seguimiento de control a 6 meses.
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
create view public.v_plan_detenido with (security_invoker = true) as
select p.id as plan_id, p.clinica_id, p.paciente_id,
       sum(i.precio_centimos)::bigint as valor_pendiente_centimos
from public.plan_tratamiento p
join public.item_plan i on i.plan_id = p.id and i.estado in ('aceptado', 'programado')
where p.estado in ('aceptado', 'en_curso', 'detenido')
  and not exists (
    select 1 from public.cita_item ci
    join public.cita c on c.id = ci.cita_id
    join public.item_plan i2 on i2.id = ci.item_plan_id
    where i2.plan_id = p.id
      and c.estado in ('programada', 'confirmada')
      and c.inicio between now() and now() + interval '30 days'
  )
group by p.id, p.clinica_id, p.paciente_id;

-- Anulación de una sola vía: solo se pasa de vigente a anulado, una vez, y
-- registra quién la hizo. Complementa los GRANT por columna.
create function privado.solo_anular() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.anulado_at is not null then
    raise exception 'El registro ya está anulado y no puede modificarse';
  end if;
  if new.anulado_at is null or new.anulado_por is distinct from auth.uid() then
    raise exception 'Solo se permite anular el registro (con motivo, a nombre propio)';
  end if;
  return new;
end $$;
create trigger solo_anular before update on public.odontograma          for each row execute function privado.solo_anular();
create trigger solo_anular before update on public.odontograma_hallazgo for each row execute function privado.solo_anular();
create trigger solo_anular before update on public.nota_evolucion       for each row execute function privado.solo_anular();
create trigger solo_anular before update on public.pago                 for each row execute function privado.solo_anular();

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
-- Índices
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
create index on public.pago_aplicacion (pago_id);
create index on public.pago_aplicacion (item_plan_id);
create index on public.pago_aplicacion (cuota_id);
create index on public.cita (clinica_id, inicio);
create index on public.cita (paciente_id);
create index on public.cita_item (item_plan_id);
create index on public.seguimiento (clinica_id, resultado, fecha_programada);
create index on public.auditoria (clinica_id, tabla, registro_id);

-- RLS activado desde el inicio: sin políticas, nadie lee ni escribe.
alter table public.auditoria enable row level security;
