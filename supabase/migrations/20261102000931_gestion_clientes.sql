-- Etapa 18 (v2): gestión de clientes para el superadministrador.
--
-- Aprobado por Pedro (11-oct): resumen del negocio, ficha de cada clínica (uso por semana sin
-- datos clínicos: solo conteos), semáforo de salud, notas internas, cobranza, búsqueda y
-- correos automáticos (bienvenida, vence en 7 días, venció, 10 días sin uso, pago revisado).
--
-- Aditiva: notas internas y registro de correos en `privado` (con clinica_id y RLS, sin
-- grants: solo por funciones) y funciones solo del superadministrador. El envío diario lo hace
-- el servidor con la service role (correos_pendientes / marcar_correo, solo service_role).

create table privado.nota_clinica (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinica (id),
  autor       uuid not null references auth.users (id),
  texto       text not null check (char_length(btrim(texto)) between 2 and 1000),
  creada_at   timestamptz not null default now()
);
create index nota_clinica_clinica on privado.nota_clinica (clinica_id, creada_at desc);
alter table privado.nota_clinica enable row level security;
revoke all on privado.nota_clinica from public, anon, authenticated;

-- Correos automáticos ya enviados (uno por clínica, tipo y referencia: nunca dos veces).
create table privado.correo_enviado (
  clinica_id  uuid not null references public.clinica (id),
  tipo        text not null check (tipo in ('vence_pronto', 'vencido', 'sin_uso')),
  referencia  text not null,
  para        text not null,
  enviado_at  timestamptz not null default now(),
  primary key (clinica_id, tipo, referencia)
);
alter table privado.correo_enviado enable row level security;
revoke all on privado.correo_enviado from public, anon, authenticated;

-- Índices para contar actividad por clínica y fecha sin recorrer tablas enteras.
create index if not exists paciente_clinica_creado on public.paciente (clinica_id, created_at);
create index if not exists cita_clinica_creada on public.cita (clinica_id, created_at);
create index if not exists nota_evolucion_clinica_creada on public.nota_evolucion (clinica_id, created_at);
create index if not exists nota_evolucion_clinica_firmada on public.nota_evolucion (clinica_id, firmada_at);

-- Pacientes de ejemplo de la prueba gratuita (no cuentan como uso real).
create function privado.es_ejemplo(nombres text) returns boolean
language sql immutable set search_path = '' as $$ select nombres like '%(ejemplo)' $$;

-- Fin del periodo vigente de una clínica (null: demo o activo sin fecha).
create function privado.fin_plan(c public.clinica) returns date
language sql immutable set search_path = '' as $$
  select case c.plan when 'prueba' then c.prueba_hasta when 'activo' then c.activo_hasta end
$$;

-- Última actividad: el ingreso más reciente de su personal o el último registro (paciente,
-- cita o evolución). Solo fechas: nunca contenido clínico.
create function privado.ultima_actividad(id_clinica uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select greatest(
    (select max(a.last_sign_in_at) from public.usuario u join auth.users a on a.id = u.id
      where u.clinica_id = id_clinica and u.activo),
    (select max(created_at) from public.paciente where clinica_id = id_clinica and not privado.es_ejemplo(nombres)),
    (select max(created_at) from public.cita where clinica_id = id_clinica),
    (select max(created_at) from public.nota_evolucion where clinica_id = id_clinica))
$$;

-- Registros en una ventana (para ver si el uso sube o baja).
create function privado.registros_entre(id_clinica uuid, desde timestamptz, hasta timestamptz) returns integer
language sql stable security definer set search_path = '' as $$
  select ((select count(*) from public.paciente where clinica_id = id_clinica and created_at >= desde and created_at < hasta
             and not privado.es_ejemplo(nombres))
        + (select count(*) from public.cita where clinica_id = id_clinica and created_at >= desde and created_at < hasta)
        + (select count(*) from public.nota_evolucion where clinica_id = id_clinica and created_at >= desde and created_at < hasta))::integer
$$;

-- Correo del primer administrador activo (contacto de la clínica).
create function privado.correo_admin(id_clinica uuid) returns table (nombre text, correo text)
language sql stable security definer set search_path = '' as $$
  select u.nombre, a.email::text from public.usuario u join auth.users a on a.id = u.id
   where u.clinica_id = id_clinica and u.activo and u.rol = 'admin' and a.email is not null
   order by u.created_at limit 1
$$;

revoke all on function privado.fin_plan(public.clinica), privado.ultima_actividad(uuid),
  privado.registros_entre(uuid, timestamptz, timestamptz), privado.correo_admin(uuid), privado.es_ejemplo(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resumen del negocio
-- ---------------------------------------------------------------------------
create function public.resumen_plataforma()
returns table (ingreso_mensual_centimos bigint, en_prueba integer, activas integer, vencidas integer, vencen_7 integer,
               pruebas_total integer, pruebas_pagadas integer, vencieron_mes integer)
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
    (select count(*) from c where not c.escribible)::integer,
    (select count(*) from c where c.fin between v_hoy and v_hoy + 7)::integer,
    -- Conversión: solo pruebas ya terminadas o pagadas (las que siguen corriendo aún no deciden).
    (select count(*) from c where c.prueba_hasta is not null
        and (c.prueba_hasta < v_hoy
             or exists (select 1 from public.pago_suscripcion p where p.clinica_id = c.id and p.estado = 'confirmado')))::integer,
    (select count(*) from c where c.prueba_hasta is not null
        and exists (select 1 from public.pago_suscripcion p where p.clinica_id = c.id and p.estado = 'confirmado'))::integer,
    (select count(*) from c where not c.escribible and c.fin >= date_trunc('month', v_hoy)::date)::integer;
end $$;
revoke all on function public.resumen_plataforma() from public, anon;
grant execute on function public.resumen_plataforma() to authenticated;

-- La lista de clínicas suma actividad, último pago y contacto.
drop function public.clinicas_plataforma();
create function public.clinicas_plataforma(solo uuid default null)
returns table (id uuid, nombre text, plan text, prueba_hasta date, activo_hasta date, creada date, usuarios bigint,
               pacientes bigint, administrador text, tarifa text, odontologos integer, ultima_actividad timestamptz,
               actividad_30 integer, actividad_previa_30 integer, ultimo_pago_estado text, correo_admin text, telefono text)
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
           c.telefono
      from public.clinica c where solo is null or c.id = solo order by c.created_at desc;
end $$;
revoke all on function public.clinicas_plataforma(uuid) from public, anon;
grant execute on function public.clinicas_plataforma(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ficha de una clínica: usuarios, pagos, uso por semana (conteos) y notas internas
-- ---------------------------------------------------------------------------
create function public.ficha_clinica(id_clinica uuid) returns jsonb
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
        'plan_hasta', p.plan_hasta) order by p.reportado_at desc)
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
      from privado.correo_enviado e where e.clinica_id = id_clinica), '[]')
  ) into v;
  return v;
end $$;
revoke all on function public.ficha_clinica(uuid) from public, anon;
grant execute on function public.ficha_clinica(uuid) to authenticated;

create function public.agregar_nota_clinica(id_clinica uuid, texto text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  if char_length(btrim(coalesce(texto, ''))) not between 2 and 1000 then
    raise exception 'La nota va de 2 a 1000 caracteres';
  end if;
  insert into privado.nota_clinica (clinica_id, autor, texto) values (id_clinica, auth.uid(), btrim(texto));
end $$;
revoke all on function public.agregar_nota_clinica(uuid, text) from public, anon;
grant execute on function public.agregar_nota_clinica(uuid, text) to authenticated;

-- Contacto del administrador de la clínica de un pago (para avisarle que fue revisado).
create function public.contacto_pago(id_pago uuid) returns table (nombre text, correo text, clinica text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  return query select a.nombre, a.correo, c.nombre
    from public.pago_suscripcion p join public.clinica c on c.id = p.clinica_id
    cross join lateral privado.correo_admin(c.id) a where p.id = id_pago;
end $$;
revoke all on function public.contacto_pago(uuid) from public, anon;
grant execute on function public.contacto_pago(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Correos automáticos diarios (solo el servidor, con la service role)
-- ---------------------------------------------------------------------------
create function public.correos_pendientes()
returns table (clinica_id uuid, tipo text, referencia text, para text, nombre text, clinica text, plan text, fecha date)
language sql stable security definer set search_path = '' as $$
  with hoy as (select (now() at time zone 'America/Lima')::date as d),
  c as (
    select cl.id, cl.nombre, cl.plan, privado.fin_plan(cl) as fin, privado.clinica_escribible(cl.id) as escribible,
           privado.ultima_actividad(cl.id) as actividad
      from public.clinica cl where cl.plan <> 'demo'
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
revoke all on function public.correos_pendientes() from public, anon, authenticated;
grant execute on function public.correos_pendientes() to service_role;

-- Se reserva ANTES de enviar: si dos ejecuciones coinciden, solo una obtiene true y envía.
create function public.reservar_correo(id_clinica uuid, tipo_correo text, ref text, destinatario text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  insert into privado.correo_enviado (clinica_id, tipo, referencia, para) values (id_clinica, tipo_correo, ref, destinatario)
  on conflict do nothing returning true into v_ok;
  return coalesce(v_ok, false);
end $$;
revoke all on function public.reservar_correo(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reservar_correo(uuid, text, text, text) to service_role;

-- Si el envío falla, se libera la reserva para reintentarlo al día siguiente (es un registro de
-- envíos, no un dato clínico).
create function public.liberar_correo(id_clinica uuid, tipo_correo text, ref text) returns void
language sql security definer set search_path = '' as $$
  delete from privado.correo_enviado where clinica_id = id_clinica and tipo = tipo_correo and referencia = ref
$$;
revoke all on function public.liberar_correo(uuid, text, text) from public, anon, authenticated;
grant execute on function public.liberar_correo(uuid, text, text) to service_role;
