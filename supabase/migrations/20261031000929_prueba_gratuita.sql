-- Etapa 16 (v2): prueba gratuita por clínica y activación manual del plan.
--
-- Decisiones de Pedro: la clínica nueva trae pacientes de ejemplo (ficticios), la prueba dura
-- 30 días, al vencer queda en SOLO LECTURA (se ve y se exporta, no se registra nada nuevo;
-- nunca se borra nada) y el plan pagado lo activa a mano el superadministrador.
--
-- Aditiva: columnas nuevas en clinica (las clínicas existentes quedan «activo» sin fecha de
-- fin, es decir, como hasta ahora; la de demostración, «demo»), tabla privada de
-- superadministradores y funciones. La solo lectura se exige en la base con un trigger en
-- todas las tablas con clinica_id (salvo auditoría y exportaciones: ver y exportar sigue
-- permitido y deja su registro).

alter table public.clinica
  add column plan          text not null default 'activo' check (plan in ('demo', 'prueba', 'activo')),
  add column prueba_hasta  date,
  add column activo_hasta  date,
  add constraint clinica_prueba_con_fecha check (plan <> 'prueba' or prueba_hasta is not null);

update public.clinica set plan = 'demo' where id = 'c0000000-0000-4000-8000-000000000001';

-- Superadministradores de la plataforma (no son usuarios de ninguna clínica). Se agregan a
-- mano, por SQL; la app no los puede escribir.
create table privado.superadmin (
  usuario_id uuid primary key references auth.users (id),
  agregado_at timestamptz not null default now()
);

create function privado.es_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from privado.superadmin where usuario_id = auth.uid())
$$;

/** La clínica puede registrar datos: demo siempre; prueba hasta su fecha; activo hasta su fecha (sin fecha: sin fin). */
create function privado.clinica_escribible(id_clinica uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case c.plan
             when 'demo' then true
             when 'prueba' then c.prueba_hasta >= (now() at time zone 'America/Lima')::date
             else c.activo_hasta is null or c.activo_hasta >= (now() at time zone 'America/Lima')::date
           end
      from public.clinica c where c.id = id_clinica), true)
$$;

-- Solo lectura al vencer: cualquier escritura desde la app (rol authenticated, también dentro
-- de las funciones SECURITY DEFINER que llama la app) se rechaza. Los procesos internos
-- (service role, migraciones, refresco de la demo) no pasan por aquí.
create function privado.solo_lectura_si_vencida() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('role', true) = 'authenticated'
     and not privado.clinica_escribible(case when tg_op = 'DELETE' then old.clinica_id else new.clinica_id end) then
    raise exception 'La prueba gratuita de la clínica terminó: está en solo lectura. Puedes ver y exportar las historias; para registrar, activa el plan.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relkind = 'r'
       and c.relname not in ('auditoria', 'exportacion_historia')
       and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'clinica_id' and not a.attisdropped)
  loop
    -- «a_» para correr antes que los demás triggers BEFORE (orden alfabético): falla primero y claro.
    execute format('create trigger a_solo_lectura before insert or update or delete on public.%I
                    for each row execute function privado.solo_lectura_si_vencida()', t.relname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Alta de la prueba gratuita
-- ---------------------------------------------------------------------------
-- La llama quien acaba de registrarse (sesión de Auth sin usuario en ninguna clínica). Crea su
-- clínica (30 días de prueba), lo deja como administrador, copia el catálogo y las plantillas
-- de la clínica de demostración (son de ejemplo y editables) y agrega 3 pacientes ficticios.
create function public.crear_clinica_prueba(nombre_clinica text, nombre_usuario text, cop text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_yo uuid := auth.uid();
  v_demo uuid := 'c0000000-0000-4000-8000-000000000001';
  v_clinica uuid;
  v_sillon uuid;
  v_paciente uuid;
  p record;
  v_mapa jsonb := '{}';
  v_nueva uuid;
begin
  if v_yo is null then
    raise exception 'Inicia sesión para crear tu clínica';
  end if;
  if exists (select 1 from public.usuario where id = v_yo) then
    raise exception 'Tu usuario ya pertenece a una clínica';
  end if;
  if char_length(btrim(coalesce(nombre_clinica, ''))) not between 3 and 120 then
    raise exception 'El nombre de la clínica va de 3 a 120 caracteres';
  end if;
  if char_length(btrim(coalesce(nombre_usuario, ''))) not between 3 and 120 then
    raise exception 'Tu nombre va de 3 a 120 caracteres';
  end if;
  if nullif(btrim(coalesce(cop, '')), '') is not null and btrim(cop) !~ '^\d{1,6}$' then
    raise exception 'El número de colegiatura (COP) tiene de 1 a 6 dígitos';
  end if;

  insert into public.clinica (nombre, plan, prueba_hasta)
  values (btrim(nombre_clinica), 'prueba', (now() at time zone 'America/Lima')::date + 30)
  returning id into v_clinica;
  insert into public.usuario (id, clinica_id, nombre, rol, cop)
  values (v_yo, v_clinica, btrim(nombre_usuario), 'admin', nullif(btrim(coalesce(cop, '')), ''));

  -- Catálogo y plantillas de ejemplo (de la clínica de demostración, si existe).
  for p in select * from public.plantilla_consentimiento where clinica_id = v_demo and activa loop
    insert into public.plantilla_consentimiento (clinica_id, tipo, nombre, descripcion, riesgos, efectos_adversos, pronostico, es_ejemplo)
    values (v_clinica, p.tipo, p.nombre, p.descripcion, p.riesgos, p.efectos_adversos, p.pronostico, true)
    returning id into v_nueva;
    v_mapa := v_mapa || jsonb_build_object(p.id::text, v_nueva);
  end loop;
  insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos,
                                    requiere_consentimiento, control_dias, consentimiento_plantilla_id)
  select v_clinica, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos, requiere_consentimiento, control_dias,
         (v_mapa ->> consentimiento_plantilla_id::text)::uuid
    from public.procedimiento where clinica_id = v_demo and activo;
  insert into public.plantilla_mensaje (clinica_id, tipo, nombre, cuerpo)
  select v_clinica, tipo, nombre, cuerpo from public.plantilla_mensaje where clinica_id = v_demo and activa;

  -- Un sillón y el horario del administrador (lunes a sábado, 9:00 a 19:00), editables.
  insert into public.sillon (clinica_id, nombre) values (v_clinica, 'Sillón 1') returning id into v_sillon;
  insert into public.horario_profesional (clinica_id, profesional_id, sillon_id, dia_semana, hora_inicio, hora_fin)
  select v_clinica, v_yo, v_sillon, d, '09:00', '19:00' from generate_series(1, 6) d;

  -- Pacientes de ejemplo: ficticios y así rotulados (sin documento, para no usar un DNI real).
  insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, sexo, telefono, consentimiento_datos_at)
  values (v_clinica, 'Ana (ejemplo)', 'Paciente Ficticia', '1990-04-12', 'femenino', '51900000001', now())
  returning id into v_paciente;
  insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, tiempo_enfermedad, alergias,
                                         embarazo, observaciones)
  values (v_clinica, v_paciente, v_yo, 'Dolor al masticar en molar inferior derecho', '2 semanas', array['Penicilina'], 'no',
          'Paciente de ejemplo (ficticio)');
  insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, sexo, telefono, consentimiento_datos_at)
  values (v_clinica, 'Jorge (ejemplo)', 'Paciente Ficticio', '1968-09-30', 'masculino', '51900000002', now())
  returning id into v_paciente;
  insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, enfermedades, anticoagulado,
                                         anticoagulante, observaciones)
  values (v_clinica, v_paciente, v_yo, 'Control y limpieza', array['hipertension', 'cardiopatia'], true, 'Warfarina 5 mg diaria',
          'Paciente de ejemplo (ficticio)');
  insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, sexo, telefono, consentimiento_datos_at,
                               apoderado_nombre, apoderado_parentesco, apoderado_telefono, apoderado_dni)
  values (v_clinica, 'Sofía (ejemplo)', 'Paciente Ficticia', ((now() at time zone 'America/Lima')::date - interval '8 years')::date,
          -- DNI 00000000: imposible en la realidad, para no usar el de una persona.
          'femenino', '51900000003', now(), 'Apoderada de ejemplo', 'madre', '51900000004', '00000000');

  return v_clinica;
end $$;
revoke all on function public.crear_clinica_prueba(text, text, text) from public, anon;
grant execute on function public.crear_clinica_prueba(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Superadministrador: ver las clínicas y activar o extender el plan
-- ---------------------------------------------------------------------------
create function public.es_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$ select privado.es_superadmin() $$;
revoke all on function public.es_superadmin() from public, anon;
grant execute on function public.es_superadmin() to authenticated;

create function public.clinicas_plataforma()
returns table (id uuid, nombre text, plan text, prueba_hasta date, activo_hasta date, creada date, usuarios bigint,
               pacientes bigint, administrador text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_superadmin() then
    raise exception 'Solo el superadministrador';
  end if;
  return query
    select c.id, c.nombre, c.plan, c.prueba_hasta, c.activo_hasta, (c.created_at at time zone 'America/Lima')::date,
           (select count(*) from public.usuario u where u.clinica_id = c.id and u.activo),
           (select count(*) from public.paciente pa where pa.clinica_id = c.id and pa.anulado_at is null),
           (select string_agg(u.nombre, ', ') from public.usuario u where u.clinica_id = c.id and u.rol = 'admin')
      from public.clinica c order by c.created_at desc;
end $$;
revoke all on function public.clinicas_plataforma() from public, anon;
grant execute on function public.clinicas_plataforma() to authenticated;

-- Activa o extiende el plan pagado (o la prueba). Queda en la auditoría.
create function public.extender_plan(id_clinica uuid, nuevo_plan text, hasta date, motivo text)
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
end $$;
revoke all on function public.extender_plan(uuid, text, date, text) from public, anon;
grant execute on function public.extender_plan(uuid, text, date, text) to authenticated;
