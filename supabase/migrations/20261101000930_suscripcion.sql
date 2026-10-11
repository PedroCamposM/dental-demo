-- Etapa 17 (v2): suscripción con cobro manual.
--
-- Decisiones de Pedro (11-oct): cobro manual primero (Yape, Plin o transferencia; la clínica
-- reporta el pago con su constancia y el superadministrador lo confirma), planes por número
-- de odontólogos activos, mensual y anual (2 meses gratis). Sin comprobantes SUNAT (fuera de
-- alcance): el comprobante se emite por fuera.
--
-- Aditiva: tarifas y datos de cobro de la plataforma (en `privado`, solo por funciones),
-- columna `clinica.tarifa`, tabla `pago_suscripcion` (con clinica_id y RLS) y bucket privado
-- `suscripcion` para las constancias. Una clínica vencida (solo lectura) SÍ puede reportar su
-- pago: esta tabla no lleva el disparador de solo lectura de la 0929.

-- ---------------------------------------------------------------------------
-- Tarifas y datos de cobro de la plataforma (no son de ninguna clínica)
-- ---------------------------------------------------------------------------
create table privado.tarifa (
  codigo            text primary key check (codigo ~ '^[a-z_]{3,30}$'),
  nombre            text not null check (char_length(nombre) between 3 and 60),
  max_odontologos   integer check (max_odontologos is null or max_odontologos > 0),  -- null: sin límite
  mensual_centimos  integer not null check (mensual_centimos > 0),
  anual_centimos    integer not null check (anual_centimos > 0),
  orden             integer not null default 0
);
alter table privado.tarifa enable row level security;
revoke all on privado.tarifa from public, anon, authenticated;

-- Precios iniciales aprobados por Pedro (editables por el superadministrador).
insert into privado.tarifa (codigo, nombre, max_odontologos, mensual_centimos, anual_centimos, orden) values
  ('consultorio', 'Consultorio', 2, 9900, 99000, 1),
  ('clinica', 'Clínica', 5, 17900, 179000, 2),
  ('clinica_plus', 'Clínica+', null, 29900, 299000, 3);

-- Una sola fila: dónde paga la clínica. La llena el superadministrador desde el panel.
create table privado.cobro (
  id            boolean primary key default true check (id),
  yape          text check (char_length(yape) <= 40),
  plin          text check (char_length(plin) <= 40),
  banco         text check (char_length(banco) <= 60),
  cuenta        text check (char_length(cuenta) <= 40),
  cci           text check (char_length(cci) <= 40),
  titular       text check (char_length(titular) <= 120),
  instrucciones text check (char_length(instrucciones) <= 500)
);
alter table privado.cobro enable row level security;
revoke all on privado.cobro from public, anon, authenticated;
insert into privado.cobro (id) values (true);

alter table public.clinica add column tarifa text;  -- la del último pago confirmado (informativa)

-- Odontólogos que cuentan para el plan: cirujanos dentistas activos (admin u odontólogo con COP).
create function privado.odontologos_activos(id_clinica uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.usuario
   where clinica_id = id_clinica and activo and rol in ('admin', 'odontologo') and cop is not null
$$;

-- Lo que ve la clínica para pagar: tarifas, datos de cobro y sus odontólogos activos.
create function public.tarifas() returns table (codigo text, nombre text, max_odontologos integer,
                                                mensual_centimos integer, anual_centimos integer)
language sql stable security definer set search_path = '' as $$
  select codigo, nombre, max_odontologos, mensual_centimos, anual_centimos from privado.tarifa order by orden, codigo
$$;
revoke all on function public.tarifas() from public, anon;
grant execute on function public.tarifas() to authenticated;

create function public.datos_cobro() returns table (yape text, plin text, banco text, cuenta text, cci text,
                                                    titular text, instrucciones text)
language sql stable security definer set search_path = '' as $$
  select yape, plin, banco, cuenta, cci, titular, instrucciones from privado.cobro
$$;
revoke all on function public.datos_cobro() from public, anon;
grant execute on function public.datos_cobro() to authenticated;

create function public.odontologos_activos() returns integer
language sql stable security definer set search_path = '' as $$
  select privado.odontologos_activos(privado.clinica_actual())
$$;
revoke all on function public.odontologos_activos() from public, anon;
grant execute on function public.odontologos_activos() to authenticated;

-- El superadministrador cambia precios y datos de cobro.
create function public.guardar_tarifa(cod text, mensual integer, anual integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if coalesce(mensual, 0) <= 0 or coalesce(anual, 0) <= 0 then
    raise exception 'Los precios deben ser mayores que cero';
  end if;
  update privado.tarifa set mensual_centimos = mensual, anual_centimos = anual where codigo = cod;
  if not found then
    raise exception 'Tarifa no encontrada';
  end if;
end $$;
revoke all on function public.guardar_tarifa(text, integer, integer) from public, anon;
grant execute on function public.guardar_tarifa(text, integer, integer) to authenticated;

create function public.guardar_cobro(datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  update privado.cobro set
    yape = nullif(btrim(datos ->> 'yape'), ''), plin = nullif(btrim(datos ->> 'plin'), ''),
    banco = nullif(btrim(datos ->> 'banco'), ''), cuenta = nullif(btrim(datos ->> 'cuenta'), ''),
    cci = nullif(btrim(datos ->> 'cci'), ''), titular = nullif(btrim(datos ->> 'titular'), ''),
    instrucciones = nullif(btrim(datos ->> 'instrucciones'), '');
end $$;
revoke all on function public.guardar_cobro(jsonb) from public, anon;
grant execute on function public.guardar_cobro(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Pagos de suscripción (los reporta el admin de la clínica; los confirma el superadmin)
-- ---------------------------------------------------------------------------
create table public.pago_suscripcion (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null references public.clinica (id),
  tarifa           text not null,
  periodo          text not null check (periodo in ('mensual', 'anual')),
  monto_centimos   integer not null check (monto_centimos > 0),
  metodo           text not null check (metodo in ('yape', 'plin', 'transferencia')),
  operacion        text not null check (char_length(operacion) between 4 and 40),
  pagado_el        date not null,
  constancia_ruta  text,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'rechazado')),
  motivo_rechazo   text,
  reportado_por    uuid not null references public.usuario (id),
  reportado_at     timestamptz not null default now(),
  revisado_por     uuid references auth.users (id),
  revisado_at      timestamptz,
  plan_hasta       date,  -- hasta cuándo quedó el plan al confirmarlo
  constraint pago_suscripcion_constancia_propia check (constancia_ruta is null or constancia_ruta like clinica_id::text || '/%'),
  constraint pago_suscripcion_rechazo_con_motivo check (estado <> 'rechazado' or char_length(btrim(motivo_rechazo)) >= 3)
);
-- La misma operación no se reporta dos veces (salvo que se haya rechazado).
create unique index pago_suscripcion_operacion_unica on public.pago_suscripcion (metodo, lower(btrim(operacion)))
  where estado <> 'rechazado';
create index pago_suscripcion_clinica on public.pago_suscripcion (clinica_id, reportado_at desc);
create index pago_suscripcion_pendientes on public.pago_suscripcion (reportado_at) where estado = 'pendiente';

alter table public.pago_suscripcion enable row level security;
-- Solo el administrador de la clínica ve sus pagos; nadie escribe directo (solo por funciones).
create policy pago_suscripcion_select on public.pago_suscripcion for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');
revoke all on public.pago_suscripcion from public, anon, authenticated;
grant select on public.pago_suscripcion to authenticated;

create function public.reportar_pago_suscripcion(cod_tarifa text, periodo_pago text, metodo_pago text, num_operacion text,
                                                 fecha_pago date, ruta_constancia text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_tarifa privado.tarifa;
  v_id uuid;
  v_hoy date := (now() at time zone 'America/Lima')::date;
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
  insert into public.pago_suscripcion (clinica_id, tarifa, periodo, monto_centimos, metodo, operacion, pagado_el,
                                       constancia_ruta, reportado_por)
  values (v_clinica, v_tarifa.codigo, periodo_pago,
          case when periodo_pago = 'anual' then v_tarifa.anual_centimos else v_tarifa.mensual_centimos end,
          metodo_pago, btrim(num_operacion), fecha_pago, ruta_constancia, auth.uid())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Ese número de operación ya fue reportado';
end $$;
revoke all on function public.reportar_pago_suscripcion(text, text, text, text, date, text) from public, anon;
grant execute on function public.reportar_pago_suscripcion(text, text, text, text, date, text) to authenticated;

-- Confirmar extiende el plan un mes o un año desde su fin actual (o desde hoy si ya venció).
-- Rechazar exige motivo. Ambos quedan en la auditoría de la clínica.
create function public.revisar_pago_suscripcion(id_pago uuid, aprobar boolean, motivo text) returns date
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
    return null;
  end if;

  select * into v_clinica from public.clinica where id = v_pago.clinica_id for update;
  v_fin := case v_clinica.plan when 'activo' then v_clinica.activo_hasta when 'prueba' then v_clinica.prueba_hasta end;
  -- Sin fecha de fin (activo sin límite) no hay nada que extender: se cuenta desde hoy.
  v_fin := greatest(coalesce(v_fin, v_hoy - 1), v_hoy - 1);
  v_hasta := (v_fin + case when v_pago.periodo = 'anual' then interval '1 year' else interval '1 month' end)::date;
  update public.clinica set plan = 'activo', activo_hasta = v_hasta, tarifa = v_pago.tarifa where id = v_clinica.id;
  update public.pago_suscripcion set estado = 'confirmado', plan_hasta = v_hasta,
         revisado_por = auth.uid(), revisado_at = now() where id = id_pago;
  insert into public.auditoria (clinica_id, usuario_id, tabla, registro_id, accion, antes, despues)
  values (v_clinica.id, auth.uid(), 'clinica', v_clinica.id, 'update',
          jsonb_build_object('plan', v_clinica.plan, 'prueba_hasta', v_clinica.prueba_hasta, 'activo_hasta', v_clinica.activo_hasta),
          jsonb_build_object('plan', 'activo', 'hasta', v_hasta, 'motivo',
                             format('Pago %s confirmado (%s, %s)', v_pago.operacion, v_pago.tarifa, v_pago.periodo)));
  return v_hasta;
end $$;
revoke all on function public.revisar_pago_suscripcion(uuid, boolean, text) from public, anon;
grant execute on function public.revisar_pago_suscripcion(uuid, boolean, text) to authenticated;

-- Pagos por confirmar (panel del superadministrador).
create function public.pagos_por_confirmar()
returns table (id uuid, clinica_id uuid, clinica text, tarifa text, periodo text, monto_centimos integer, metodo text,
               operacion text, pagado_el date, constancia_ruta text, reportado_at timestamptz, odontologos integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  return query
    select p.id, p.clinica_id, c.nombre, p.tarifa, p.periodo, p.monto_centimos, p.metodo, p.operacion, p.pagado_el,
           p.constancia_ruta, p.reportado_at, privado.odontologos_activos(p.clinica_id)
      from public.pago_suscripcion p join public.clinica c on c.id = p.clinica_id
     where p.estado = 'pendiente' order by p.reportado_at;
end $$;
revoke all on function public.pagos_por_confirmar() from public, anon;
grant execute on function public.pagos_por_confirmar() to authenticated;

-- El panel de clínicas muestra además la tarifa y los odontólogos activos.
drop function public.clinicas_plataforma();
create function public.clinicas_plataforma()
returns table (id uuid, nombre text, plan text, prueba_hasta date, activo_hasta date, creada date, usuarios bigint,
               pacientes bigint, administrador text, tarifa text, odontologos integer)
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
           c.tarifa, privado.odontologos_activos(c.id)
      from public.clinica c order by c.created_at desc;
end $$;
revoke all on function public.clinicas_plataforma() from public, anon;
grant execute on function public.clinicas_plataforma() to authenticated;

-- ---------------------------------------------------------------------------
-- Constancias de pago: bucket privado. El admin sube a la carpeta de su clínica (también
-- vencida: es para reactivarla); el superadmin las ve todas.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('suscripcion', 'suscripcion', false, 1572864, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy suscripcion_select on storage.objects for select to authenticated
  using (bucket_id = 'suscripcion'
         and (((storage.foldername(name))[1] = (select privado.clinica_actual())::text and (select privado.rol_actual()) = 'admin')
              or (select privado.es_superadmin())));
create policy suscripcion_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'suscripcion'
              and (storage.foldername(name))[1] = (select privado.clinica_actual())::text
              and (select privado.rol_actual()) = 'admin');
