-- Etapa 20 (v2): herramientas del superadministrador y nombre de la clínica.
--
-- Aprobado por Pedro (11-oct): editar el nombre de la clínica (su admin desde Configuración y
-- el superadministrador desde la ficha, con auditoría), suspender y reactivar una clínica con
-- motivo, descuento por clínica (se aplica solo al reportar el pago), avisos dentro del
-- sistema (a todas las clínicas o a una), progreso de activación, reporte de ingresos y
-- bitácora de lo que hace el superadministrador.
--
-- Aditiva: columna `clinica.suspendida_at`, `pago_suscripcion.descuento_pct`, tablas en
-- `privado` (sin grants: solo por funciones) y funciones. Una clínica suspendida queda en
-- SOLO LECTURA (como una vencida): sigue viendo y exportando sus historias (son de sus
-- pacientes), pero no registra nada nuevo hasta que se reactive.

alter table public.clinica add column suspendida_at timestamptz;
alter table public.pago_suscripcion add column descuento_pct integer check (descuento_pct between 1 and 90);

-- El nombre se cambia solo por cambiar_nombre_clinica (valida y deja auditoría).
revoke update (nombre) on public.clinica from authenticated;

-- ---------------------------------------------------------------------------
-- Bitácora del superadministrador (qué cambió, cuándo y en qué clínica)
-- ---------------------------------------------------------------------------
create table privado.bitacora_plataforma (
  id          bigint generated always as identity primary key,
  superadmin  uuid not null references auth.users (id),
  accion      text not null,
  clinica_id  uuid references public.clinica (id),  -- null: cambios de la plataforma (precios, cobro, avisos a todas)
  detalle     jsonb not null default '{}',
  creada_at   timestamptz not null default now()
);
create index bitacora_plataforma_fecha on privado.bitacora_plataforma (creada_at desc);
create index bitacora_plataforma_clinica on privado.bitacora_plataforma (clinica_id, creada_at desc);
alter table privado.bitacora_plataforma enable row level security;
revoke all on privado.bitacora_plataforma from public, anon, authenticated;

create function privado.anotar_plataforma(accion text, id_clinica uuid, detalle jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into privado.bitacora_plataforma (superadmin, accion, clinica_id, detalle)
  values (auth.uid(), accion, id_clinica, coalesce(detalle, '{}'))
$$;
revoke all on function privado.anotar_plataforma(text, uuid, jsonb) from public, anon, authenticated;

create function public.bitacora_plataforma(id_clinica uuid default null, limite integer default 100)
returns table (creada_at timestamptz, autor text, accion text, clinica_id uuid, clinica text, detalle jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  return query
    select b.creada_at, a.email::text, b.accion, b.clinica_id, c.nombre, b.detalle
      from privado.bitacora_plataforma b
      left join auth.users a on a.id = b.superadmin
      left join public.clinica c on c.id = b.clinica_id
     where id_clinica is null or b.clinica_id = id_clinica
     order by b.creada_at desc, b.id desc
     limit least(greatest(coalesce(limite, 100), 1), 500);
end $$;
revoke all on function public.bitacora_plataforma(uuid, integer) from public, anon;
grant execute on function public.bitacora_plataforma(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Suspensión: solo lectura con su propio mensaje
-- ---------------------------------------------------------------------------
create or replace function privado.clinica_escribible(id_clinica uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
             when c.plan = 'demo' then true
             when c.suspendida_at is not null then false
             when c.plan = 'prueba' then c.prueba_hasta >= (now() at time zone 'America/Lima')::date
             else c.activo_hasta is null or c.activo_hasta >= (now() at time zone 'America/Lima')::date
           end
      from public.clinica c where c.id = id_clinica), true)
$$;

create or replace function privado.error_solo_lectura(id_clinica uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v public.clinica;
begin
  select * into v from public.clinica where id = id_clinica;
  if v.suspendida_at is not null then
    raise exception using
      message = 'La cuenta de la clínica está suspendida: está en solo lectura. Puedes ver y exportar las historias; para reactivarla, escríbenos a contacto.hud@gmail.com';
  end if;
  if v.plan = 'prueba' then
    raise exception using
      message = 'La prueba gratuita de la clínica terminó: está en solo lectura. Puedes ver y exportar las historias; para registrar, activa el plan';
  end if;
  raise exception using
    message = 'El plan de la clínica venció: está en solo lectura. Puedes ver y exportar las historias; para registrar, renueva el plan';
end $$;

create function public.suspender_clinica(id_clinica uuid, suspender boolean, motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.clinica;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if suspender is null then
    raise exception 'Indica si suspendes o reactivas';
  end if;
  if char_length(btrim(coalesce(motivo, ''))) not between 3 and 500 then
    raise exception 'Escribe el motivo (de 3 a 500 caracteres)';
  end if;
  select * into v from public.clinica where id = id_clinica for update;
  if v.id is null then
    raise exception 'Clínica no encontrada';
  end if;
  if v.plan = 'demo' then
    raise exception 'La clínica de demostración no se suspende';
  end if;
  if suspender and v.suspendida_at is not null then
    raise exception 'La clínica ya está suspendida';
  end if;
  if not suspender and v.suspendida_at is null then
    raise exception 'La clínica no está suspendida';
  end if;
  update public.clinica set suspendida_at = case when suspender then now() end where id = id_clinica;
  insert into public.auditoria (clinica_id, usuario_id, tabla, registro_id, accion, antes, despues)
  values (id_clinica, auth.uid(), 'clinica', id_clinica, 'update',
          jsonb_build_object('suspendida_at', v.suspendida_at),
          jsonb_build_object('suspendida', suspender, 'motivo', btrim(motivo)));
  perform privado.anotar_plataforma(case when suspender then 'suspender' else 'reactivar' end, id_clinica,
                                    jsonb_build_object('motivo', btrim(motivo)));
end $$;
revoke all on function public.suspender_clinica(uuid, boolean, text) from public, anon;
grant execute on function public.suspender_clinica(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nombre de la clínica: su administrador (vigente) o el superadministrador (con motivo)
-- ---------------------------------------------------------------------------
create function public.cambiar_nombre_clinica(id_clinica uuid, nuevo_nombre text, motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.clinica;
  v_super boolean := privado.es_superadmin();
  v_nombre text := regexp_replace(btrim(coalesce(nuevo_nombre, '')), '\s+', ' ', 'g');
begin
  if not v_super and (privado.rol_actual() is distinct from 'admin' or id_clinica is distinct from privado.clinica_actual()) then
    raise exception 'Solo el administrador de la clínica';
  end if;
  if char_length(v_nombre) not between 3 and 120 then
    raise exception 'El nombre de la clínica va de 3 a 120 caracteres';
  end if;
  if v_super and char_length(btrim(coalesce(motivo, ''))) < 3 then
    raise exception 'Escribe el motivo (p. ej. la clínica pidió corregir el nombre)';
  end if;
  select * into v from public.clinica where id = id_clinica for update;
  if v.id is null then
    raise exception 'Clínica no encontrada';
  end if;
  if v.plan = 'demo' then
    raise exception 'El nombre de la clínica de demostración no se cambia';
  end if;
  if v.nombre = v_nombre then
    return;
  end if;
  -- El disparador de la 0929 rechaza el cambio si la clínica está en solo lectura (salvo superadmin).
  update public.clinica set nombre = v_nombre where id = id_clinica;
  insert into public.auditoria (clinica_id, usuario_id, tabla, registro_id, accion, antes, despues)
  values (id_clinica, auth.uid(), 'clinica', id_clinica, 'update', jsonb_build_object('nombre', v.nombre),
          jsonb_build_object('nombre', v_nombre) || case when v_super then jsonb_build_object('motivo', btrim(motivo)) else '{}' end);
  if v_super then
    perform privado.anotar_plataforma('cambiar_nombre', id_clinica,
                                      jsonb_build_object('antes', v.nombre, 'despues', v_nombre, 'motivo', btrim(motivo)));
  end if;
end $$;
revoke all on function public.cambiar_nombre_clinica(uuid, text, text) from public, anon;
grant execute on function public.cambiar_nombre_clinica(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Descuento por clínica (porcentaje sobre la tarifa, con fecha de fin opcional)
-- ---------------------------------------------------------------------------
create table privado.descuento_clinica (
  clinica_id  uuid primary key references public.clinica (id),
  porcentaje  integer not null check (porcentaje between 1 and 90),
  hasta       date,  -- null: sin fin
  motivo      text not null check (char_length(btrim(motivo)) between 3 and 300),
  creado_por  uuid not null references auth.users (id),
  creado_at   timestamptz not null default now()
);
alter table privado.descuento_clinica enable row level security;
revoke all on privado.descuento_clinica from public, anon, authenticated;

-- Porcentaje vigente hoy (null si no tiene).
create function privado.descuento_vigente(id_clinica uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select porcentaje from privado.descuento_clinica
   where clinica_id = id_clinica and (hasta is null or hasta >= (now() at time zone 'America/Lima')::date)
$$;
revoke all on function privado.descuento_vigente(uuid) from public, anon, authenticated;

-- Porcentaje 0 o null: quita el descuento.
create function public.guardar_descuento(id_clinica uuid, porcentaje integer, hasta date, motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_plan text;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  select plan into v_plan from public.clinica where id = id_clinica;
  if v_plan is null then
    raise exception 'Clínica no encontrada';
  end if;
  if v_plan = 'demo' then
    raise exception 'La clínica de demostración no tiene plan';
  end if;
  if char_length(btrim(coalesce(motivo, ''))) not between 3 and 300 then
    raise exception 'Escribe el motivo (de 3 a 300 caracteres)';
  end if;
  if coalesce(porcentaje, 0) = 0 then
    delete from privado.descuento_clinica where clinica_id = id_clinica;
    if found then
      perform privado.anotar_plataforma('quitar_descuento', id_clinica, jsonb_build_object('motivo', btrim(motivo)));
    end if;
    return;
  end if;
  if porcentaje not between 1 and 90 then
    raise exception 'El descuento va de 1 %% a 90 %%';
  end if;
  if hasta is not null and hasta < (now() at time zone 'America/Lima')::date then
    raise exception 'La fecha de fin del descuento debe ser hoy o posterior';
  end if;
  insert into privado.descuento_clinica (clinica_id, porcentaje, hasta, motivo, creado_por)
  values (id_clinica, porcentaje, hasta, btrim(motivo), auth.uid())
  on conflict (clinica_id) do update set porcentaje = excluded.porcentaje, hasta = excluded.hasta, motivo = excluded.motivo,
                                         creado_por = excluded.creado_por, creado_at = now();
  perform privado.anotar_plataforma('descuento', id_clinica,
                                    jsonb_build_object('porcentaje', porcentaje, 'hasta', hasta, 'motivo', btrim(motivo)));
end $$;
revoke all on function public.guardar_descuento(uuid, integer, date, text) from public, anon;
grant execute on function public.guardar_descuento(uuid, integer, date, text) to authenticated;

-- Lo que ve el administrador de la clínica al pagar.
create function public.mi_descuento() returns table (porcentaje integer, hasta date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if privado.rol_actual() is distinct from 'admin' then
    return;
  end if;
  return query select d.porcentaje, d.hasta from privado.descuento_clinica d
    where d.clinica_id = privado.clinica_actual() and (d.hasta is null or d.hasta >= (now() at time zone 'America/Lima')::date);
end $$;
revoke all on function public.mi_descuento() from public, anon;
grant execute on function public.mi_descuento() to authenticated;

-- Reportar el pago aplica el descuento vigente (el monto lo pone la base, nunca la clínica).
create or replace function public.reportar_pago_suscripcion(cod_tarifa text, periodo_pago text, metodo_pago text, num_operacion text,
                                                            fecha_pago date, ruta_constancia text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_tarifa privado.tarifa;
  v_id uuid;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_pct integer;
  v_base integer;
begin
  if v_clinica is null or privado.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el administrador de la clínica reporta pagos';
  end if;
  if (select plan from public.clinica where id = v_clinica) = 'demo' then
    raise exception 'La clínica de demostración no tiene plan';
  end if;
  select * into v_tarifa from privado.tarifa where codigo = cod_tarifa;
  if v_tarifa.codigo is null then
    raise exception 'Elige un plan';
  end if;
  if periodo_pago not in ('mensual', 'anual') then
    raise exception 'Elige si pagas mensual o anual';
  end if;
  if metodo_pago not in ('yape', 'plin', 'transferencia') then
    raise exception 'Elige cómo pagaste';
  end if;
  if char_length(btrim(coalesce(num_operacion, ''))) not between 4 and 40 then
    raise exception 'Escribe el número de operación (de 4 a 40 caracteres)';
  end if;
  if fecha_pago is null or fecha_pago > v_hoy or fecha_pago < v_hoy - 60 then
    raise exception 'La fecha del pago debe ser de los últimos 60 días';
  end if;
  if ruta_constancia is not null and ruta_constancia not like v_clinica::text || '/%' then
    raise exception 'Constancia inválida';
  end if;
  if exists (select 1 from public.pago_suscripcion where clinica_id = v_clinica and estado = 'pendiente') then
    raise exception 'Ya tienes un pago por confirmar. Espera la confirmación antes de reportar otro';
  end if;
  v_pct := privado.descuento_vigente(v_clinica);
  v_base := case when periodo_pago = 'anual' then v_tarifa.anual_centimos else v_tarifa.mensual_centimos end;
  insert into public.pago_suscripcion (clinica_id, tarifa, periodo, monto_centimos, metodo, operacion, pagado_el,
                                       constancia_ruta, reportado_por, descuento_pct)
  values (v_clinica, v_tarifa.codigo, periodo_pago,
          case when v_pct is null then v_base else round(v_base * (100 - v_pct) / 100.0)::integer end,
          metodo_pago, btrim(num_operacion), fecha_pago, ruta_constancia, auth.uid(), v_pct)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  declare v_restriccion text;
  begin
    get stacked diagnostics v_restriccion = constraint_name;
    if v_restriccion = 'pago_suscripcion_un_pendiente' then
      raise exception 'Ya tienes un pago por confirmar. Espera la confirmación antes de reportar otro';
    end if;
    raise exception 'Ese número de operación ya fue reportado';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Avisos dentro del sistema (a todas las clínicas o a una)
-- ---------------------------------------------------------------------------
create table privado.aviso_plataforma (
  id           uuid primary key default gen_random_uuid(),
  clinica_id   uuid references public.clinica (id),  -- null: todas las clínicas
  texto        text not null check (char_length(btrim(texto)) between 3 and 500),
  nivel        text not null default 'info' check (nivel in ('info', 'importante')),
  hasta        date not null,
  creado_por   uuid not null references auth.users (id),
  creado_at    timestamptz not null default now(),
  retirado_at  timestamptz
);
create index aviso_plataforma_vigente on privado.aviso_plataforma (hasta) where retirado_at is null;
alter table privado.aviso_plataforma enable row level security;
revoke all on privado.aviso_plataforma from public, anon, authenticated;

create function public.publicar_aviso(id_clinica uuid, texto text, nivel text, hasta date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_hoy date := (now() at time zone 'America/Lima')::date;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if char_length(btrim(coalesce(texto, ''))) not between 3 and 500 then
    raise exception 'El aviso va de 3 a 500 caracteres';
  end if;
  if coalesce(nivel, '') not in ('info', 'importante') then
    raise exception 'Elige el tipo de aviso';
  end if;
  if hasta is null or hasta < v_hoy or hasta > v_hoy + 90 then
    raise exception 'El aviso dura de hoy a 90 días';
  end if;
  if id_clinica is not null and not exists (select 1 from public.clinica where id = id_clinica) then
    raise exception 'Clínica no encontrada';
  end if;
  insert into privado.aviso_plataforma (clinica_id, texto, nivel, hasta, creado_por)
  values (id_clinica, btrim(texto), nivel, hasta, auth.uid()) returning id into v_id;
  perform privado.anotar_plataforma('publicar_aviso', id_clinica,
                                    jsonb_build_object('texto', btrim(texto), 'nivel', nivel, 'hasta', hasta));
  return v_id;
end $$;
revoke all on function public.publicar_aviso(uuid, text, text, date) from public, anon;
grant execute on function public.publicar_aviso(uuid, text, text, date) to authenticated;

create function public.retirar_aviso(id_aviso uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v privado.aviso_plataforma;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  update privado.aviso_plataforma set retirado_at = now() where id = id_aviso and retirado_at is null returning * into v;
  if v.id is null then
    raise exception 'Aviso no encontrado o ya retirado';
  end if;
  perform privado.anotar_plataforma('retirar_aviso', v.clinica_id, jsonb_build_object('texto', v.texto));
end $$;
revoke all on function public.retirar_aviso(uuid) from public, anon;
grant execute on function public.retirar_aviso(uuid) to authenticated;

-- Avisos del panel (vigentes y de los últimos 30 días).
create function public.avisos_plataforma()
returns table (id uuid, clinica_id uuid, clinica text, texto text, nivel text, hasta date, creado_at timestamptz, vigente boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_hoy date := (now() at time zone 'America/Lima')::date;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  return query
    select a.id, a.clinica_id, c.nombre, a.texto, a.nivel, a.hasta, a.creado_at, a.retirado_at is null and a.hasta >= v_hoy
      from privado.aviso_plataforma a left join public.clinica c on c.id = a.clinica_id
     where a.creado_at >= now() - interval '30 days' or (a.retirado_at is null and a.hasta >= v_hoy)
     order by a.creado_at desc;
end $$;
revoke all on function public.avisos_plataforma() from public, anon;
grant execute on function public.avisos_plataforma() to authenticated;

-- Lo que ve cualquier usuario activo de una clínica.
create function public.avisos_vigentes() returns table (id uuid, texto text, nivel text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.texto, a.nivel from privado.aviso_plataforma a
   where privado.clinica_actual() is not null
     and (a.clinica_id is null or a.clinica_id = privado.clinica_actual())
     and a.retirado_at is null and a.hasta >= (now() at time zone 'America/Lima')::date
   order by a.nivel = 'importante' desc, a.creado_at desc
   limit 3
$$;
revoke all on function public.avisos_vigentes() from public, anon;
grant execute on function public.avisos_vigentes() to authenticated;

-- ---------------------------------------------------------------------------
-- Progreso de activación (solo sí o no: nunca contenido clínico)
-- ---------------------------------------------------------------------------
create function privado.activacion(id_clinica uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'paciente', exists (select 1 from public.paciente where clinica_id = id_clinica and anulado_at is null
                          and not privado.es_ejemplo(nombres)),
    'cita', exists (select 1 from public.cita where clinica_id = id_clinica),
    'evolucion', exists (select 1 from public.nota_evolucion where clinica_id = id_clinica and firmada_at is not null),
    'equipo', (select count(*) from public.usuario where clinica_id = id_clinica and activo) >= 2,
    'pago', exists (select 1 from public.pago_suscripcion where clinica_id = id_clinica and estado = 'confirmado'))
$$;
revoke all on function privado.activacion(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lista, resumen y ficha: suspensión, descuento y activación
-- ---------------------------------------------------------------------------
drop function public.clinicas_plataforma(uuid);
create function public.clinicas_plataforma(solo uuid default null)
returns table (id uuid, nombre text, plan text, prueba_hasta date, activo_hasta date, creada date, usuarios bigint,
               pacientes bigint, administrador text, tarifa text, odontologos integer, ultima_actividad timestamptz,
               actividad_30 integer, actividad_previa_30 integer, ultimo_pago_estado text, correo_admin text, telefono text,
               suspendida_at timestamptz, descuento_pct integer, activacion integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  return query
    select c.id, c.nombre, c.plan, c.prueba_hasta, c.activo_hasta, (c.created_at at time zone 'America/Lima')::date,
           (select count(*) from public.usuario u where u.clinica_id = c.id and u.activo),
           (select count(*) from public.paciente pa where pa.clinica_id = c.id and pa.anulado_at is null),
           (select string_agg(u.nombre, ', ') from public.usuario u where u.clinica_id = c.id and u.rol = 'admin'),
           c.tarifa, privado.odontologos_activos(c.id), privado.ultima_actividad(c.id),
           privado.registros_entre(c.id, now() - interval '30 days', now()),
           privado.registros_entre(c.id, now() - interval '60 days', now() - interval '30 days'),
           (select p.estado from public.pago_suscripcion p where p.clinica_id = c.id order by p.reportado_at desc limit 1),
           (select a.correo from privado.correo_admin(c.id) a),
           c.telefono, c.suspendida_at, privado.descuento_vigente(c.id),
           (select count(*)::integer from jsonb_each(privado.activacion(c.id)) e where e.value = 'true'::jsonb)
      from public.clinica c where solo is null or c.id = solo order by c.created_at desc;
end $$;
revoke all on function public.clinicas_plataforma(uuid) from public, anon;
grant execute on function public.clinicas_plataforma(uuid) to authenticated;

drop function public.resumen_plataforma();
create function public.resumen_plataforma()
returns table (ingreso_mensual_centimos bigint, en_prueba integer, activas integer, vencidas integer, vencen_7 integer,
               pruebas_total integer, pruebas_pagadas integer, vencieron_mes integer, suspendidas integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_hoy date := (now() at time zone 'America/Lima')::date;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  return query
  with c as (
    select cl.*, privado.fin_plan(cl) as fin, privado.clinica_escribible(cl.id) as escribible
      from public.clinica cl where cl.plan <> 'demo'
  ),
  -- Ingreso mensual: el último pago confirmado de cada clínica vigente, llevado a un mes.
  ultimo as (
    select distinct on (p.clinica_id) p.clinica_id, p.periodo, p.monto_centimos
      from public.pago_suscripcion p where p.estado = 'confirmado'
     order by p.clinica_id, p.revisado_at desc
  )
  select
    coalesce((select sum(case u.periodo when 'anual' then round(u.monto_centimos / 12.0) else u.monto_centimos end)
                from ultimo u join c on c.id = u.clinica_id where c.plan = 'activo' and c.escribible), 0)::bigint,
    (select count(*) from c where c.plan = 'prueba' and c.escribible)::integer,
    (select count(*) from c where c.plan = 'activo' and c.escribible)::integer,
    (select count(*) from c where not c.escribible and c.suspendida_at is null)::integer,
    (select count(*) from c where c.suspendida_at is null and c.fin between v_hoy and v_hoy + 7)::integer,
    -- Conversión: solo pruebas ya terminadas o pagadas (las que siguen corriendo aún no deciden).
    (select count(*) from c where c.prueba_hasta is not null
        and (c.prueba_hasta < v_hoy
             or exists (select 1 from public.pago_suscripcion p where p.clinica_id = c.id and p.estado = 'confirmado')))::integer,
    (select count(*) from c where c.prueba_hasta is not null
        and exists (select 1 from public.pago_suscripcion p where p.clinica_id = c.id and p.estado = 'confirmado'))::integer,
    (select count(*) from c where not c.escribible and c.suspendida_at is null and c.fin >= date_trunc('month', v_hoy)::date)::integer,
    (select count(*) from c where c.suspendida_at is not null)::integer;
end $$;
revoke all on function public.resumen_plataforma() from public, anon;
grant execute on function public.resumen_plataforma() to authenticated;

-- La ficha suma activación, descuento y la bitácora de esa clínica.
create or replace function public.ficha_clinica(id_clinica uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lunes date := date_trunc('week', (now() at time zone 'America/Lima'))::date;
  v jsonb;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if not exists (select 1 from public.clinica where id = id_clinica) then
    raise exception 'Clínica no encontrada';
  end if;
  select jsonb_build_object(
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object(
        'nombre', u.nombre, 'rol', u.rol, 'activo', u.activo, 'correo', a.email,
        'ultimo_ingreso', a.last_sign_in_at, 'cirujano_dentista', u.cop is not null) order by u.activo desc, u.nombre)
      from public.usuario u join auth.users a on a.id = u.id where u.clinica_id = id_clinica), '[]'),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object(
        'tarifa', p.tarifa, 'periodo', p.periodo, 'monto_centimos', p.monto_centimos, 'metodo', p.metodo,
        'operacion', p.operacion, 'pagado_el', p.pagado_el, 'estado', p.estado, 'motivo_rechazo', p.motivo_rechazo,
        'plan_hasta', p.plan_hasta, 'descuento_pct', p.descuento_pct) order by p.reportado_at desc)
      from public.pago_suscripcion p where p.clinica_id = id_clinica), '[]'),
    'semanas', (select jsonb_agg(jsonb_build_object(
        'desde', s.lunes,
        'pacientes', (select count(*) from public.paciente where clinica_id = id_clinica and not privado.es_ejemplo(nombres)
                        and created_at >= s.desde and created_at < s.hasta),
        'citas', (select count(*) from public.cita where clinica_id = id_clinica
                        and created_at >= s.desde and created_at < s.hasta),
        'evoluciones', (select count(*) from public.nota_evolucion where clinica_id = id_clinica
                        and firmada_at >= s.desde and firmada_at < s.hasta)) order by s.lunes)
      from (select l.lunes, (l.lunes::timestamp at time zone 'America/Lima') as desde,
                   ((l.lunes + 7)::timestamp at time zone 'America/Lima') as hasta
              from (select (v_lunes - 7 * g)::date as lunes from generate_series(0, 7) g) l) s),
    'notas', coalesce((select jsonb_agg(jsonb_build_object('texto', n.texto, 'creada_at', n.creada_at,
        'autor', (select email from auth.users where id = n.autor)) order by n.creada_at desc)
      from privado.nota_clinica n where n.clinica_id = id_clinica), '[]'),
    'correos', coalesce((select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'enviado_at', e.enviado_at) order by e.enviado_at desc)
      from privado.correo_enviado e where e.clinica_id = id_clinica), '[]'),
    'activacion', privado.activacion(id_clinica),
    'descuento', (select jsonb_build_object('porcentaje', d.porcentaje, 'hasta', d.hasta, 'motivo', d.motivo,
        'vigente', d.hasta is null or d.hasta >= (now() at time zone 'America/Lima')::date)
      from privado.descuento_clinica d where d.clinica_id = id_clinica),
    'bitacora', coalesce((select jsonb_agg(jsonb_build_object('accion', b.accion, 'detalle', b.detalle, 'creada_at', b.creada_at,
        'autor', (select email from auth.users where id = b.superadmin)) order by b.creada_at desc, b.id desc)
      from (select * from privado.bitacora_plataforma where clinica_id = id_clinica order by creada_at desc, id desc limit 50) b), '[]')
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Reporte de ingresos: pagos confirmados entre dos fechas (de confirmación, hora de Lima)
-- ---------------------------------------------------------------------------
create function public.ingresos_plataforma(desde date, hasta date)
returns table (confirmado_el date, clinica_id uuid, clinica text, tarifa text, periodo text, monto_centimos integer,
               descuento_pct integer, metodo text, operacion text, pagado_el date, plan_hasta date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if desde is null or hasta is null or desde > hasta then
    raise exception 'Elige un rango de fechas válido';
  end if;
  if hasta - desde > 731 then
    raise exception 'El rango va hasta 2 años';
  end if;
  return query
    select (p.revisado_at at time zone 'America/Lima')::date, p.clinica_id, c.nombre, p.tarifa, p.periodo, p.monto_centimos,
           p.descuento_pct, p.metodo, p.operacion, p.pagado_el, p.plan_hasta
      from public.pago_suscripcion p join public.clinica c on c.id = p.clinica_id
     where p.estado = 'confirmado'
       and p.revisado_at >= (desde::timestamp at time zone 'America/Lima')
       and p.revisado_at < ((hasta + 1)::timestamp at time zone 'America/Lima')
     order by p.revisado_at;
end $$;
revoke all on function public.ingresos_plataforma(date, date) from public, anon;
grant execute on function public.ingresos_plataforma(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Lo que ya hacía el superadministrador ahora queda en su bitácora
-- ---------------------------------------------------------------------------
create or replace function public.extender_plan(id_clinica uuid, nuevo_plan text, hasta date, motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_antes public.clinica;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if nuevo_plan not in ('prueba', 'activo') then
    raise exception 'Plan inválido';
  end if;
  if hasta is null or hasta < (now() at time zone 'America/Lima')::date then
    raise exception 'La fecha de fin debe ser hoy o posterior';
  end if;
  if char_length(btrim(coalesce(motivo, ''))) < 3 then
    raise exception 'Escribe el motivo (p. ej. pago por transferencia del 10-oct)';
  end if;
  select * into v_antes from public.clinica where id = id_clinica for update;
  if v_antes.id is null then
    raise exception 'Clínica no encontrada';
  end if;
  if v_antes.plan = 'demo' then
    raise exception 'La clínica de demostración no tiene plan';
  end if;
  update public.clinica
     set plan = nuevo_plan,
         prueba_hasta = case when nuevo_plan = 'prueba' then hasta else prueba_hasta end,
         activo_hasta = case when nuevo_plan = 'activo' then hasta else activo_hasta end
   where id = id_clinica;
  insert into public.auditoria (clinica_id, usuario_id, tabla, registro_id, accion, antes, despues)
  values (id_clinica, auth.uid(), 'clinica', id_clinica, 'update',
          jsonb_build_object('plan', v_antes.plan, 'prueba_hasta', v_antes.prueba_hasta, 'activo_hasta', v_antes.activo_hasta),
          jsonb_build_object('plan', nuevo_plan, 'hasta', hasta, 'motivo', btrim(motivo)));
  perform privado.anotar_plataforma('extender_plan', id_clinica,
                                    jsonb_build_object('plan', nuevo_plan, 'hasta', hasta, 'motivo', btrim(motivo)));
end $$;

create or replace function public.revisar_pago_suscripcion(id_pago uuid, aprobar boolean, motivo text) returns date
language plpgsql security definer set search_path = '' as $$
declare
  v_pago public.pago_suscripcion;
  v_clinica public.clinica;
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_fin date;
  v_hasta date;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if aprobar is null then
    raise exception 'Indica si confirmas o rechazas el pago';
  end if;
  select * into v_pago from public.pago_suscripcion where id = id_pago for update;
  if v_pago.id is null then
    raise exception 'Pago no encontrado';
  end if;
  if v_pago.estado <> 'pendiente' then
    raise exception 'Ese pago ya fue revisado';
  end if;
  if not aprobar then
    if char_length(btrim(coalesce(motivo, ''))) < 3 then
      raise exception 'Escribe el motivo del rechazo';
    end if;
    update public.pago_suscripcion set estado = 'rechazado', motivo_rechazo = btrim(motivo),
           revisado_por = auth.uid(), revisado_at = now() where id = id_pago;
    insert into public.auditoria (clinica_id, usuario_id, tabla, registro_id, accion, antes, despues)
    values (v_pago.clinica_id, auth.uid(), 'pago_suscripcion', id_pago, 'update',
            jsonb_build_object('estado', 'pendiente'), jsonb_build_object('estado', 'rechazado', 'motivo', btrim(motivo)));
    perform privado.anotar_plataforma('rechazar_pago', v_pago.clinica_id,
                                      jsonb_build_object('operacion', v_pago.operacion, 'monto_centimos', v_pago.monto_centimos,
                                                         'motivo', btrim(motivo)));
    return null;
  end if;

  select * into v_clinica from public.clinica where id = v_pago.clinica_id for update;
  v_fin := case v_clinica.plan when 'activo' then v_clinica.activo_hasta when 'prueba' then v_clinica.prueba_hasta end;
  -- Sin fecha de fin (activo sin límite) no hay nada que extender: se cuenta desde hoy.
  v_fin := greatest(coalesce(v_fin, v_hoy - 1), v_hoy - 1);
  v_hasta := ((v_fin + 1) + case when v_pago.periodo = 'anual' then interval '1 year' else interval '1 month' end)::date - 1;
  update public.clinica set plan = 'activo', activo_hasta = v_hasta, tarifa = v_pago.tarifa where id = v_clinica.id;
  update public.pago_suscripcion set estado = 'confirmado', plan_hasta = v_hasta,
         revisado_por = auth.uid(), revisado_at = now() where id = id_pago;
  insert into public.auditoria (clinica_id, usuario_id, tabla, registro_id, accion, antes, despues)
  values (v_clinica.id, auth.uid(), 'clinica', v_clinica.id, 'update',
          jsonb_build_object('plan', v_clinica.plan, 'prueba_hasta', v_clinica.prueba_hasta, 'activo_hasta', v_clinica.activo_hasta),
          jsonb_build_object('plan', 'activo', 'hasta', v_hasta, 'motivo',
                             format('Pago %s confirmado (%s, %s)', v_pago.operacion, v_pago.tarifa, v_pago.periodo)));
  perform privado.anotar_plataforma('confirmar_pago', v_clinica.id,
                                    jsonb_build_object('operacion', v_pago.operacion, 'monto_centimos', v_pago.monto_centimos,
                                                       'hasta', v_hasta));
  return v_hasta;
end $$;

create or replace function public.guardar_tarifa(cod text, mensual integer, anual integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_antes privado.tarifa;
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if coalesce(mensual, 0) <= 0 or coalesce(anual, 0) <= 0 then
    raise exception 'Los precios deben ser mayores que cero';
  end if;
  select * into v_antes from privado.tarifa where codigo = cod for update;
  if v_antes.codigo is null then
    raise exception 'Tarifa no encontrada';
  end if;
  update privado.tarifa set mensual_centimos = mensual, anual_centimos = anual where codigo = cod;
  if v_antes.mensual_centimos <> mensual or v_antes.anual_centimos <> anual then
    perform privado.anotar_plataforma('cambiar_precio', null,
      jsonb_build_object('tarifa', cod, 'antes', jsonb_build_object('mensual', v_antes.mensual_centimos, 'anual', v_antes.anual_centimos),
                         'despues', jsonb_build_object('mensual', mensual, 'anual', anual)));
  end if;
end $$;

create or replace function public.guardar_cobro(datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  update privado.cobro set
    yape = nullif(btrim(datos ->> 'yape'), ''), plin = nullif(btrim(datos ->> 'plin'), ''),
    banco = nullif(btrim(datos ->> 'banco'), ''), cuenta = nullif(btrim(datos ->> 'cuenta'), ''),
    cci = nullif(btrim(datos ->> 'cci'), ''), titular = nullif(btrim(datos ->> 'titular'), ''),
    instrucciones = nullif(btrim(datos ->> 'instrucciones'), '')
  where id;  -- fila única; Supabase rechaza un UPDATE sin WHERE desde la API
  perform privado.anotar_plataforma('datos_cobro', null, '{}');
end $$;

create or replace function public.agregar_nota_clinica(id_clinica uuid, texto text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if char_length(btrim(coalesce(texto, ''))) not between 2 and 1000 then
    raise exception 'La nota va de 2 a 1000 caracteres';
  end if;
  insert into privado.nota_clinica (clinica_id, autor, texto) values (id_clinica, auth.uid(), btrim(texto));
  perform privado.anotar_plataforma('nota', id_clinica, '{}');
end $$;

-- ---------------------------------------------------------------------------
-- Correos automáticos: a una clínica suspendida no se le escribe por plan ni por uso
-- ---------------------------------------------------------------------------
create or replace function public.correos_pendientes()
returns table (clinica_id uuid, tipo text, referencia text, para text, nombre text, clinica text, plan text, fecha date)
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'America/Lima')::date as d),
  c as (
    select cl.id, cl.nombre, cl.plan, privado.fin_plan(cl) as fin, privado.clinica_escribible(cl.id) as escribible,
           privado.ultima_actividad(cl.id) as actividad
      from public.clinica cl where cl.plan <> 'demo' and cl.suspendida_at is null
  ),
  candidatos as (
    -- Vence en 7 días o menos (uno por fecha de fin)
    select c.id, 'vence_pronto'::text as tipo, c.fin::text as referencia, c.nombre, c.plan, c.fin as fecha
      from c, hoy where c.fin between hoy.d and hoy.d + 7
       -- Si ya reportó su pago, no se le pide pagar.
       and not exists (select 1 from public.pago_suscripcion p where p.clinica_id = c.id and p.estado = 'pendiente')
    union all
    -- Venció en la última semana (uno por fecha de fin)
    select c.id, 'vencido', c.fin::text, c.nombre, c.plan, c.fin
      from c, hoy where not c.escribible and c.fin between hoy.d - 7 and hoy.d - 1
    union all
    -- 10 días sin uso estando vigente (uno por racha: la referencia es el día de la última actividad)
    select c.id, 'sin_uso', ((c.actividad at time zone 'America/Lima')::date)::text, c.nombre, c.plan,
           (c.actividad at time zone 'America/Lima')::date
      from c, hoy where c.escribible and c.actividad is not null
                    and (c.actividad at time zone 'America/Lima')::date <= hoy.d - 10
                    -- Solo rachas recientes: no se escribe a quien dejó de usarlo hace meses.
                    and (c.actividad at time zone 'America/Lima')::date >= hoy.d - 30
  )
  select k.id, k.tipo, k.referencia, a.correo, a.nombre, k.nombre, k.plan, k.fecha
    from candidatos k cross join lateral privado.correo_admin(k.id) a
   where not exists (select 1 from privado.correo_enviado e
                      where e.clinica_id = k.id and e.tipo = k.tipo and e.referencia = k.referencia)
$$;
