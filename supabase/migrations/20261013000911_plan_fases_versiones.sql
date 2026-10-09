-- Etapa 5 (v2): plan de tratamiento con fases, dependencias, diagnóstico de origen,
-- alternativas y versiones. Aditiva: tablas y columnas nuevas, un estado nuevo
-- («reemplazado») y funciones para aceptar un plan y crear una versión o alternativa.
--
-- El estado clínico del ítem ya está separado del cobro desde la v1: item_plan.estado
-- no tiene «cobrado» y el cobro se calcula desde los pagos (v_item_cobro). No hace
-- falta migrar ítems «cobrado».
-- Verificación de datos: supabase/verificaciones/20261013000911_plan_fases_versiones.sql

-- Un plan reemplazado por una versión nueva aceptada (o una alternativa no elegida
-- queda «rechazado», con motivo).
alter type public.estado_plan add value if not exists 'reemplazado';

-- ---------------------------------------------------------------------------
-- Grupo: versiones y alternativas de una misma propuesta de tratamiento
-- ---------------------------------------------------------------------------
alter table public.plan_tratamiento add column grupo_id uuid;

-- Relleno: cada plan es su propio grupo, salvo las alternativas (B, C…) del seed v1,
-- que se presentaron el mismo día que la alternativa A del mismo paciente.
-- Determinista: si hubiera dos A el mismo día se toma la primera creada, y cada letra
-- entra una sola vez al grupo (las demás quedan como grupo propio).
update public.plan_tratamiento set grupo_id = id;
with pares as (
  select distinct on (b.id) b.id as alternativa_id, a.id as plan_a, b.alternativa, b.created_at
    from public.plan_tratamiento b
    join public.plan_tratamiento a
      on a.alternativa = 'A' and a.paciente_id = b.paciente_id and a.clinica_id = b.clinica_id and a.id <> b.id
     and (a.presentado_at at time zone 'America/Lima')::date = (b.presentado_at at time zone 'America/Lima')::date
   where b.alternativa <> 'A'
   order by b.id, a.created_at, a.id),
unicos as (
  select distinct on (plan_a, alternativa) alternativa_id, plan_a from pares order by plan_a, alternativa, created_at)
update public.plan_tratamiento b set grupo_id = u.plan_a from unicos u where b.id = u.alternativa_id;

-- El grupo nunca lo elige el cliente: es el propio plan, o el del plan de origen, que
-- debe ser de la misma clínica y del mismo paciente. Después no cambia (salvo el
-- sistema: seed o migración, sin usuario).
create function privado.completar_grupo_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_origen public.plan_tratamiento;
begin
  if tg_op = 'UPDATE' then
    if new.grupo_id is distinct from old.grupo_id and privado.rol_actual() is not null and not privado.en_fusion() then
      raise exception 'El grupo del plan no se modifica';
    end if;
    return new;
  end if;
  if new.plan_origen_id is null then
    if privado.rol_actual() is not null or new.grupo_id is null then
      new.grupo_id := new.id;
    end if;
    return new;
  end if;
  select * into v_origen from public.plan_tratamiento where id = new.plan_origen_id;
  if v_origen.id is null or v_origen.clinica_id <> new.clinica_id or v_origen.paciente_id <> new.paciente_id then
    raise exception 'El plan de origen no es de este paciente';
  end if;
  new.grupo_id := v_origen.grupo_id;
  return new;
end $$;
create trigger completar_grupo before insert or update on public.plan_tratamiento
  for each row execute function privado.completar_grupo_plan();
alter table public.plan_tratamiento alter column grupo_id set not null;
create index plan_grupo_idx on public.plan_tratamiento (grupo_id);
-- Una sola fila por grupo, versión y alternativa.
create unique index plan_grupo_version_alternativa on public.plan_tratamiento (grupo_id, version, alternativa);

-- ---------------------------------------------------------------------------
-- Fases del plan (las nombra el odontólogo: no se inventa una clasificación)
-- ---------------------------------------------------------------------------
create table public.plan_fase (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null,
  plan_id     uuid not null,
  numero      smallint not null check (numero between 1 and 9),
  nombre      text not null check (char_length(btrim(nombre)) between 2 and 80),
  created_at  timestamptz not null default now(),
  unique (plan_id, numero),
  foreign key (clinica_id, plan_id) references public.plan_tratamiento (clinica_id, id)
);
alter table public.plan_fase enable row level security;

-- ---------------------------------------------------------------------------
-- Ítem: fase, duración, diagnóstico de origen
-- ---------------------------------------------------------------------------
alter table public.item_plan
  add column fase smallint not null default 1 check (fase between 1 and 9),
  add column duracion_minutos smallint check (duracion_minutos between 5 and 480),
  add column diagnostico_id uuid;
alter table public.item_plan
  add constraint item_plan_diagnostico_fk foreign key (clinica_id, diagnostico_id)
  references public.diagnostico (clinica_id, id);
create index item_plan_diagnostico_idx on public.item_plan (diagnostico_id) where diagnostico_id is not null;

-- El diagnóstico de origen es del mismo paciente y está vigente; el CIE-10 del ítem
-- se toma de él. La fase debe existir en el plan (si el plan ya tiene fases).
create function privado.validar_item_origen() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_cie10 text;
begin
  if new.diagnostico_id is not null
     and (tg_op = 'INSERT' or new.diagnostico_id is distinct from old.diagnostico_id) then
    select d.cie10 into v_cie10
      from public.diagnostico d join public.plan_tratamiento p on p.id = new.plan_id
     where d.id = new.diagnostico_id and d.paciente_id = p.paciente_id and d.anulado_at is null;
    if v_cie10 is null then
      raise exception 'El diagnóstico de origen no es de este paciente o está anulado';
    end if;
    new.cie10 := v_cie10;
  end if;
  if (tg_op = 'INSERT' or new.fase is distinct from old.fase)
     and exists (select 1 from public.plan_fase f where f.plan_id = new.plan_id)
     and not exists (select 1 from public.plan_fase f where f.plan_id = new.plan_id and f.numero = new.fase) then
    raise exception 'La fase % no existe en este plan', new.fase;
  end if;
  return new;
end $$;
create trigger validar_origen before insert or update on public.item_plan
  for each row execute function privado.validar_item_origen();

-- ---------------------------------------------------------------------------
-- Dependencias: un ítem requiere que otro del mismo plan esté realizado antes
-- ---------------------------------------------------------------------------
create table public.item_dependencia (
  id            uuid primary key default gen_random_uuid(),
  clinica_id    uuid not null,
  item_id       uuid not null,
  requiere_id   uuid not null,
  created_at    timestamptz not null default now(),
  unique (item_id, requiere_id),
  check (item_id <> requiere_id),
  foreign key (clinica_id, item_id)     references public.item_plan (clinica_id, id),
  foreign key (clinica_id, requiere_id) references public.item_plan (clinica_id, id)
);
alter table public.item_dependencia enable row level security;

create function privado.validar_dependencia() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.item_plan a join public.item_plan b on b.plan_id = a.plan_id
                  where a.id = new.item_id and b.id = new.requiere_id) then
    raise exception 'Las dependencias son entre ítems del mismo plan';
  end if;
  -- Sin ciclos: el requerido no puede depender (directa o indirectamente) del ítem.
  if exists (
    with recursive cadena(id) as (
      select requiere_id from public.item_dependencia where item_id = new.requiere_id
      union
      select d.requiere_id from public.item_dependencia d join cadena c on d.item_id = c.id)
    select 1 from cadena where id = new.item_id) or new.requiere_id = new.item_id then
    raise exception 'Esa dependencia formaría un ciclo';
  end if;
  return new;
end $$;
create trigger validar before insert on public.item_dependencia
  for each row execute function privado.validar_dependencia();

-- Un ítem no se marca realizado antes que los que requiere (si el dentista canceló
-- el requerido, ya no bloquea: fue su decisión clínica, con motivo).
create function privado.validar_item_dependencias() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado = 'realizado' and (tg_op = 'INSERT' or old.estado <> 'realizado')
     and exists (select 1 from public.item_dependencia d join public.item_plan r on r.id = d.requiere_id
                  where d.item_id = new.id and r.estado not in ('realizado', 'cancelado')) then
    raise exception 'Primero debe realizarse lo que este ítem requiere';
  end if;
  return new;
end $$;
create trigger validar_dependencias before insert or update on public.item_plan
  for each row execute function privado.validar_item_dependencias();

-- ---------------------------------------------------------------------------
-- Procesos del sistema (aceptar un plan): consecuencias que el rol que registra la
-- decisión no podría escribir a mano (reemplazar la versión anterior, cancelar
-- ítems de otras alternativas). Solo dentro de funciones SECURITY DEFINER.
-- ---------------------------------------------------------------------------
create function privado.en_proceso() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('dental.proceso', true), '') = 'on' and current_user <> 'authenticated'
$$;
grant execute on function privado.en_proceso() to authenticated;

create or replace function privado.validar_cambio_plan_por_rol() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.rol_actual() is null or privado.es_dentista() or privado.en_fusion() or privado.en_proceso() then
    return new;
  end if;
  if (to_jsonb(new) - array['estado', 'motivo_rechazo', 'aceptado_at', 'terminado_at', 'updated_at'])
     is distinct from (to_jsonb(old) - array['estado', 'motivo_rechazo', 'aceptado_at', 'terminado_at', 'updated_at']) then
    raise exception 'Solo un cirujano dentista puede modificar el contenido del plan';
  end if;
  if new.terminado_at is distinct from old.terminado_at and new.estado = old.estado then
    raise exception 'Solo un cirujano dentista puede modificar el contenido del plan';
  end if;
  if new.estado is distinct from old.estado
     and not (old.estado = 'propuesto' and new.estado in ('aceptado', 'rechazado')) then
    raise exception 'Recepción solo puede registrar si el paciente acepta o rechaza el presupuesto';
  end if;
  return new;
end $$;

create or replace function privado.validar_cambio_item_por_rol() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.rol_actual() is null or privado.es_dentista() or privado.en_fusion() or privado.en_proceso() then
    return new;
  end if;
  if (to_jsonb(new) - array['estado', 'motivo_cancelacion', 'updated_at'])
     is distinct from (to_jsonb(old) - array['estado', 'motivo_cancelacion', 'updated_at']) then
    raise exception 'Solo un cirujano dentista puede modificar el procedimiento, la pieza, el diagnóstico o el precio';
  end if;
  -- Recepción registra la decisión del paciente (acepta o no un ítem propuesto)
  -- y programa o desprograma lo aceptado. Nada más.
  if new.estado is distinct from old.estado
     and not (old.estado = 'propuesto' and new.estado in ('aceptado', 'cancelado'))
     and not (old.estado in ('aceptado', 'programado') and new.estado in ('aceptado', 'programado')) then
    raise exception 'Recepción solo puede aceptar o cancelar ítems propuestos y programar los aceptados';
  end if;
  if new.motivo_cancelacion is distinct from old.motivo_cancelacion and new.estado <> 'cancelado' then
    raise exception 'Solo un cirujano dentista puede modificar el procedimiento, la pieza, el diagnóstico o el precio';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Aceptar un plan: el paciente elige una alternativa (y, si se quiere, solo
-- algunos ítems). Las otras alternativas del grupo quedan rechazadas y la versión
-- anterior aceptada queda reemplazada (sus ítems pendientes se cancelan).
-- Lo puede registrar recepción o un cirujano dentista (decisión del paciente).
-- ---------------------------------------------------------------------------
create function public.aceptar_plan(id_plan uuid, items uuid[] default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_tratamiento;
  v_rol text := privado.rol_actual();
begin
  if v_rol is null or v_rol = 'asistente' then
    raise exception 'Tu rol no registra la aceptación del plan';
  end if;
  select * into v_plan from public.plan_tratamiento
   where id = id_plan and clinica_id = privado.clinica_actual() for update;
  if v_plan.id is null then
    raise exception 'Plan no encontrado';
  end if;
  if v_plan.estado <> 'propuesto' then
    raise exception 'Solo se acepta un plan propuesto';
  end if;
  if exists (select 1 from public.paciente where id = v_plan.paciente_id and anulado_at is not null) then
    raise exception 'El paciente está anulado: registra el plan en el paciente vigente';
  end if;
  -- Bloquea el grupo (solo de esta clínica y paciente) para decidir sin carreras.
  perform 1 from public.plan_tratamiento
   where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id and paciente_id = v_plan.paciente_id for update;
  if items is not null and (cardinality(items) = 0 or exists (
       select 1 from unnest(items) x where not exists (
         select 1 from public.item_plan i where i.id = x and i.plan_id = id_plan and i.estado = 'propuesto'))) then
    raise exception 'Elige ítems propuestos de este plan';
  end if;
  -- Lo aceptado no puede depender de algo que no se acepta.
  if items is not null and exists (
       select 1 from public.item_dependencia d join public.item_plan r on r.id = d.requiere_id
        where d.item_id = any (items) and r.estado = 'propuesto' and not (r.id = any (items))) then
    raise exception 'Un ítem aceptado se hace después de otro que no se acepta: acéptalos juntos o pide al odontólogo una versión nueva';
  end if;
  -- Otro plan en marcha del grupo se reemplaza; si en lo pendiente hay pagos, cuotas
  -- por cobrar o citas futuras, primero hay que resolverlo (no se pierden ni se duplican).
  if exists (
       select 1 from public.plan_tratamiento p
        where p.grupo_id = v_plan.grupo_id and p.clinica_id = v_plan.clinica_id and p.paciente_id = v_plan.paciente_id
          and p.id <> id_plan and p.estado in ('aceptado', 'en_curso', 'detenido')
          and (exists (select 1 from public.v_cuota_saldo c where c.plan_id = p.id and c.saldo_centimos > 0)
            or exists (select 1 from public.item_plan i join public.pago_aplicacion a on a.item_plan_id = i.id
                        join public.pago g on g.id = a.pago_id and g.anulado_at is null
                        where i.plan_id = p.id and i.estado in ('aceptado', 'programado'))
            or exists (select 1 from public.item_plan i join public.cita_item ci on ci.item_plan_id = i.id
                        join public.cita c on c.id = ci.cita_id
                        where i.plan_id = p.id and i.estado in ('aceptado', 'programado')
                          and c.estado in ('programada', 'confirmada') and c.inicio > now()))) then
    raise exception 'El plan anterior tiene cuotas por cobrar, pagos o citas en lo pendiente: resuélvelos antes de reemplazarlo';
  end if;

  perform set_config('dental.proceso', 'on', true);
  update public.plan_tratamiento set estado = 'aceptado', aceptado_at = now() where id = id_plan;
  update public.item_plan set estado = 'aceptado'
   where plan_id = id_plan and estado = 'propuesto' and (items is null or id = any (items));
  update public.item_plan set estado = 'cancelado', motivo_cancelacion = 'El paciente no lo aceptó'
   where plan_id = id_plan and estado = 'propuesto';

  -- Otras alternativas o versiones aún propuestas: rechazadas con motivo.
  update public.item_plan i set estado = 'cancelado', motivo_cancelacion = 'Se eligió otra alternativa o versión'
    from public.plan_tratamiento p
   where p.id = i.plan_id and p.grupo_id = v_plan.grupo_id and p.clinica_id = v_plan.clinica_id
     and p.paciente_id = v_plan.paciente_id and p.id <> id_plan and p.estado = 'propuesto' and i.estado = 'propuesto';
  update public.plan_tratamiento
     set estado = 'rechazado',
         motivo_rechazo = 'Se eligió la ' || case when alternativa <> v_plan.alternativa
                                                  then 'alternativa ' || v_plan.alternativa
                                                  else 'versión ' || v_plan.version end
   where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id and paciente_id = v_plan.paciente_id
     and id <> id_plan and estado = 'propuesto';

  -- Planes en marcha del grupo: reemplazados; lo hecho se conserva.
  update public.item_plan i set estado = 'cancelado',
         motivo_cancelacion = 'Reemplazado por la versión ' || v_plan.version
                              || case when v_plan.alternativa <> 'A' then ' (alternativa ' || v_plan.alternativa || ')' else '' end
    from public.plan_tratamiento p
   where p.id = i.plan_id and p.grupo_id = v_plan.grupo_id and p.clinica_id = v_plan.clinica_id
     and p.paciente_id = v_plan.paciente_id and p.id <> id_plan
     and p.estado in ('aceptado', 'en_curso', 'detenido') and i.estado in ('propuesto', 'aceptado', 'programado');
  update public.plan_tratamiento set estado = 'reemplazado'
   where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id and paciente_id = v_plan.paciente_id
     and id <> id_plan and estado in ('aceptado', 'en_curso', 'detenido');
  perform set_config('dental.proceso', 'off', true);
end $$;
revoke all on function public.aceptar_plan(uuid, uuid[]) from public, anon;
grant execute on function public.aceptar_plan(uuid, uuid[]) to authenticated;

-- Rechazo del paciente: el plan y sus ítems propuestos, en una sola transacción.
create function public.rechazar_plan(id_plan uuid, motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_tratamiento;
  v_rol text := privado.rol_actual();
begin
  if v_rol is null or v_rol = 'asistente' then
    raise exception 'Tu rol no registra el rechazo del plan';
  end if;
  if char_length(btrim(coalesce(motivo, ''))) < 3 then
    raise exception 'Escribe el motivo que dio el paciente';
  end if;
  select * into v_plan from public.plan_tratamiento
   where id = id_plan and clinica_id = privado.clinica_actual() for update;
  if v_plan.id is null then
    raise exception 'Plan no encontrado';
  end if;
  if v_plan.estado <> 'propuesto' then
    raise exception 'Solo se rechaza un plan propuesto';
  end if;
  perform set_config('dental.proceso', 'on', true);
  update public.plan_tratamiento set estado = 'rechazado', motivo_rechazo = btrim(motivo) where id = id_plan;
  update public.item_plan set estado = 'cancelado', motivo_cancelacion = 'El paciente rechazó el plan'
   where plan_id = id_plan and estado = 'propuesto';
  perform set_config('dental.proceso', 'off', true);
end $$;
revoke all on function public.rechazar_plan(uuid, text) from public, anon;
grant execute on function public.rechazar_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nueva versión (misma alternativa, versión + 1) o nueva alternativa (misma
-- versión, letra siguiente) a partir de un plan: copia fases, ítems pendientes y
-- dependencias. Solo un cirujano dentista. Devuelve el id del plan nuevo.
-- La alternativa se presenta junto a un plan propuesto; la versión, desde uno
-- propuesto o en marcha.
-- ---------------------------------------------------------------------------
create function public.copiar_plan(id_plan uuid, como text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_tratamiento;
  v_nuevo uuid := gen_random_uuid();
  v_version smallint;
  v_alternativa char(1);
begin
  if not privado.es_dentista() then
    raise exception 'Solo un cirujano dentista crea versiones o alternativas del plan';
  end if;
  if como not in ('version', 'alternativa') then
    raise exception 'Indica si es una versión o una alternativa';
  end if;
  select * into v_plan from public.plan_tratamiento where id = id_plan and clinica_id = privado.clinica_actual();
  if v_plan.id is null then
    raise exception 'Plan no encontrado';
  end if;
  if como = 'alternativa' and v_plan.estado <> 'propuesto' then
    raise exception 'Las alternativas se presentan junto a un plan propuesto; para cambiar uno aceptado, crea una versión';
  end if;
  if v_plan.estado not in ('propuesto', 'aceptado', 'en_curso', 'detenido') then
    raise exception 'Este plan ya no se puede copiar';
  end if;
  if exists (select 1 from public.paciente where id = v_plan.paciente_id and anulado_at is not null) then
    raise exception 'El paciente está anulado: registra el plan en el paciente vigente';
  end if;
  -- Bloquea el grupo para numerar sin choques.
  perform 1 from public.plan_tratamiento
   where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id and paciente_id = v_plan.paciente_id for update;
  if como = 'version' then
    v_version := (select max(version) + 1 from public.plan_tratamiento
                   where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id);
    v_alternativa := v_plan.alternativa;
  else
    v_version := v_plan.version;
    v_alternativa := chr(ascii((select max(alternativa) from public.plan_tratamiento
                                 where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id
                                   and version = v_plan.version)) + 1);
    if v_alternativa > 'Z' then
      raise exception 'No caben más alternativas';
    end if;
  end if;

  insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, plan_origen_id, grupo_id,
                                       version, alternativa, estado, fecha_vencimiento)
  values (v_nuevo, v_plan.clinica_id, v_plan.paciente_id, auth.uid(), v_plan.titulo, v_plan.id, v_plan.grupo_id,
          v_version, v_alternativa, 'propuesto', (now() at time zone 'America/Lima')::date + 30);
  insert into public.plan_fase (clinica_id, plan_id, numero, nombre)
  select clinica_id, v_nuevo, numero, nombre from public.plan_fase where plan_id = v_plan.id;

  -- Ítems pendientes (lo realizado o cancelado queda en el plan anterior)
  create temp table copia_item on commit drop as
  select i.id as viejo, gen_random_uuid() as nuevo from public.item_plan i
   where i.plan_id = v_plan.id and i.estado in ('propuesto', 'aceptado', 'programado');
  insert into public.item_plan (id, clinica_id, plan_id, pieza, superficies, procedimiento, procedimiento_id, cie10,
                                diagnostico_id, precio_centimos, duracion_minutos, odontologo_id, estado, orden, fase)
  select c.nuevo, i.clinica_id, v_nuevo, i.pieza, i.superficies, i.procedimiento, i.procedimiento_id, i.cie10,
         (select d.id from public.diagnostico d where d.id = i.diagnostico_id and d.anulado_at is null),
         i.precio_centimos, i.duracion_minutos, i.odontologo_id, 'propuesto', i.orden, i.fase
    from public.item_plan i join copia_item c on c.viejo = i.id;
  insert into public.item_dependencia (clinica_id, item_id, requiere_id)
  select v_plan.clinica_id, a.nuevo, b.nuevo
    from public.item_dependencia d join copia_item a on a.viejo = d.item_id join copia_item b on b.viejo = d.requiere_id;
  drop table copia_item;
  return v_nuevo;
end $$;
revoke all on function public.copiar_plan(uuid, text) from public, anon;
grant execute on function public.copiar_plan(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: fases y dependencias las ve toda la clínica (como el plan) y las escribe
-- el cirujano dentista. No se borran: si el orden cambia, se hace una versión nueva.
-- ---------------------------------------------------------------------------
create policy plan_fase_select on public.plan_fase for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy plan_fase_insert on public.plan_fase for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
create policy plan_fase_update on public.plan_fase for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual()));

create policy item_dependencia_select on public.item_dependencia for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy item_dependencia_insert on public.item_dependencia for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));

revoke all on public.plan_fase, public.item_dependencia from anon, authenticated;
grant select, insert on public.plan_fase to authenticated;
grant update (nombre) on public.plan_fase to authenticated;
grant select, insert on public.item_dependencia to authenticated;

create trigger auditar after insert or update on public.plan_fase
  for each row execute function privado.auditar_simple();
create trigger auditar after insert on public.item_dependencia
  for each row execute function privado.auditar_simple();
