-- Etapa 8 (v2), rebanada 1: seguimiento clínico y regla 5.
--
-- Aditiva:
-- - Tipos de seguimiento clínicos: control posoperatorio, retiro de puntos, control de
--   ortodoncia, mantenimiento periodontal, control anual y laboratorio atrasado (este
--   último lo genera la Etapa 10).
-- - seguimiento.item_plan_id: el control nace del procedimiento realizado.
-- - Regla 5: al realizarse un procedimiento con «control automático» en el catálogo se
--   crea su control (tipo según la especialidad); al quedar todo el plan realizado, el
--   plan pasa a «terminado» y se crea el control de los 6 meses (regla de la v1).
-- - El plan pasa a «en curso» con el primer ítem realizado.
-- - Plan detenido (regla 6): una cita «en sala» también cuenta como cita próxima.

alter type public.tipo_seguimiento add value if not exists 'control_posoperatorio';
alter type public.tipo_seguimiento add value if not exists 'retiro_puntos';
alter type public.tipo_seguimiento add value if not exists 'control_ortodoncia';
alter type public.tipo_seguimiento add value if not exists 'mantenimiento_periodontal';
alter type public.tipo_seguimiento add value if not exists 'control_anual';
alter type public.tipo_seguimiento add value if not exists 'laboratorio_atrasado';

alter table public.seguimiento add column item_plan_id uuid;
alter table public.seguimiento
  add constraint seguimiento_item_fk foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id);
-- Un control automático por ítem (si el ítem se repite en otra versión, es otro ítem).
create unique index seguimiento_control_item on public.seguimiento (item_plan_id) where item_plan_id is not null;

-- El vínculo con el ítem lo pone solo el control automático: un seguimiento manual con
-- item_plan_id bloquearía en silencio el control del procedimiento (índice único).
-- Función invocadora: current_user es «authenticated» solo en las peticiones de la app.
create function privado.validar_seguimiento_item() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated'
     and new.item_plan_id is distinct from (case when tg_op = 'UPDATE' then old.item_plan_id end) then
    raise exception 'El control de un procedimiento lo crea el sistema al realizarlo';
  end if;
  return new;
end $$;
create trigger validar_item before insert or update on public.seguimiento
  for each row execute function privado.validar_seguimiento_item();

-- Tipo de control según la especialidad del procedimiento (texto: los valores nuevos del
-- enum no se pueden usar en esta misma transacción fuera de cuerpos plpgsql).
create function privado.tipo_control(esp public.especialidad) returns text
language plpgsql immutable set search_path = '' as $$
begin
  return case esp::text
    when 'cirugia' then 'retiro_puntos'
    when 'implantes' then 'control_posoperatorio'
    when 'ortodoncia' then 'control_ortodoncia'
    when 'periodoncia' then 'mantenimiento_periodontal'
    when 'endodoncia' then 'control_posoperatorio'
    else 'control'
  end;
end $$;

-- Al realizarse o cancelarse un ítem: control automático del procedimiento y estado del
-- plan. El plan termina cuando no le quedan ítems por hacer y tiene al menos uno realizado
-- (si el profesional cancela el último pendiente, el plan también termina: regla 5).
create function privado.al_realizar_item() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_tratamiento;
  v_proc public.procedimiento;
  v_pendientes int;
  v_previo text;
begin
  if new.estado = old.estado or new.estado not in ('realizado', 'cancelado') then
    return new;
  end if;
  -- Las cancelaciones de un proceso (aceptar otra versión o alternativa: el plan pasa a
  -- «reemplazado») no cierran el plan; solo la cancelación directa del profesional.
  if new.estado = 'cancelado' and coalesce(current_setting('dental.proceso', true), 'off') = 'on' then
    return new;
  end if;
  select * into v_plan from public.plan_tratamiento where id = new.plan_id;
  if new.estado = 'realizado' then
    select * into v_proc from public.procedimiento where id = new.procedimiento_id;
    if v_proc.control_dias is not null then
      insert into public.seguimiento (clinica_id, paciente_id, plan_id, item_plan_id, tipo, fecha_programada, nota)
      values (new.clinica_id, v_plan.paciente_id, new.plan_id, new.id,
              privado.tipo_control(v_proc.especialidad)::public.tipo_seguimiento,
              ((coalesce(new.realizado_at, now()) at time zone 'America/Lima')::date + v_proc.control_dias),
              left(new.procedimiento || coalesce(' (pieza ' || new.pieza || ')', ''), 200))
      on conflict do nothing;
    end if;
  end if;
  if v_plan.estado in ('aceptado', 'en_curso', 'detenido') then
    select count(*) into v_pendientes from public.item_plan
     where plan_id = new.plan_id and id <> new.id and estado in ('propuesto', 'aceptado', 'programado');
    -- Se restaura el valor previo: quien llama (p. ej. firmar_evolucion) puede tenerlo encendido.
    v_previo := coalesce(current_setting('dental.proceso', true), 'off');
    perform set_config('dental.proceso', 'on', true);
    if v_pendientes = 0 and (new.estado = 'realizado' or exists (
         select 1 from public.item_plan where plan_id = new.plan_id and estado = 'realizado')) then
      -- crear_control_al_terminar() crea el control de los 6 meses.
      update public.plan_tratamiento set estado = 'terminado' where id = new.plan_id;
    elsif new.estado = 'realizado' and v_plan.estado = 'aceptado' then
      update public.plan_tratamiento set estado = 'en_curso' where id = new.plan_id;
    end if;
    perform set_config('dental.proceso', v_previo, true);
  end if;
  return new;
end $$;
create trigger al_realizar after update of estado on public.item_plan
  for each row execute function privado.al_realizar_item();

-- Regla 6 con «en sala» (solo la de hoy: una olvidada no exime para siempre) (la vista se recrea con las mismas columnas).
create or replace view public.v_plan_detenido with (security_invoker = true) as
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
      and ((c.estado = 'en_sala' and (c.inicio at time zone 'America/Lima')::date = (now() at time zone 'America/Lima')::date)
           or (c.estado in ('programada', 'confirmada') and c.inicio between now() and now() + interval '30 days'))
  )
group by p.id, p.clinica_id, p.paciente_id;
