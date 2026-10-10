-- Etapa 2 (v2): sillones, horarios de los profesionales, bloqueos de agenda y
-- validación de citas. Aditiva: tablas nuevas y columnas opcionales en cita.
--
-- Regla: la agenda no permite citar fuera del horario del profesional ni sobre un
-- bloqueo, salvo que el administrador lo fuerce con un motivo (queda registrado).
-- Dos citas activas nunca se superponen para el mismo profesional ni el mismo sillón.

create type public.tipo_bloqueo as enum ('vacaciones', 'feriado', 'capacitacion', 'otro');

-- ---------------------------------------------------------------------------
-- Sillones
-- ---------------------------------------------------------------------------
create table public.sillon (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinica (id),
  nombre      text not null check (char_length(btrim(nombre)) between 1 and 40),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (clinica_id, id)
);
create unique index sillon_nombre_unico on public.sillon (clinica_id, lower(btrim(nombre)));
alter table public.sillon enable row level security;
create trigger auditar after insert or update on public.sillon
  for each row execute function privado.auditar_simple();

-- ---------------------------------------------------------------------------
-- Horario semanal: un bloque por profesional y día (ISO: 1 = lunes … 7 = domingo).
-- Nada se borra (regla 8): un día sin atención queda inactivo.
-- ---------------------------------------------------------------------------
create table public.horario_profesional (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  profesional_id  uuid not null,
  sillon_id       uuid not null,
  dia_semana      smallint not null check (dia_semana between 1 and 7),
  hora_inicio     time not null check (extract(second from hora_inicio) = 0 and extract(minute from hora_inicio)::int % 5 = 0),
  hora_fin        time not null check (extract(second from hora_fin) = 0 and extract(minute from hora_fin)::int % 5 = 0),
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (clinica_id, id),
  unique (profesional_id, dia_semana),
  check (hora_fin <= time '23:55'),
  foreign key (clinica_id, profesional_id) references public.usuario (clinica_id, id),
  foreign key (clinica_id, sillon_id)      references public.sillon (clinica_id, id),
  check (hora_fin > hora_inicio)
);
alter table public.horario_profesional enable row level security;
create index horario_sillon_idx on public.horario_profesional (sillon_id, dia_semana);
create trigger updated_at before update on public.horario_profesional
  for each row execute function privado.tocar_updated_at();
create trigger auditar after insert or update on public.horario_profesional
  for each row execute function privado.auditar_simple();

-- Solo atienden cirujanos dentistas, en un sillón activo que nadie más ocupa ese día y hora.
create function privado.validar_horario() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_otro record;
begin
  if not new.activo then
    return new;
  end if;
  if not exists (select 1 from public.usuario
                 where id = new.profesional_id and rol in ('admin', 'odontologo') and cop is not null and activo) then
    raise exception 'Solo se asignan horarios a odontólogos activos con COP';
  end if;
  if not exists (select 1 from public.sillon where id = new.sillon_id and activo) then
    raise exception 'El sillón está inactivo';
  end if;
  select u.nombre, h.hora_inicio, h.hora_fin into v_otro
    from public.horario_profesional h join public.usuario u on u.id = h.profesional_id
   where h.sillon_id = new.sillon_id and h.dia_semana = new.dia_semana and h.id <> new.id and h.activo
     and h.hora_inicio < new.hora_fin and new.hora_inicio < h.hora_fin
   limit 1;
  if found then
    raise exception 'Ese sillón ya está asignado a % ese día de % a %',
      v_otro.nombre, to_char(v_otro.hora_inicio, 'HH24:MI'), to_char(v_otro.hora_fin, 'HH24:MI');
  end if;
  return new;
end $$;
create trigger validar before insert or update on public.horario_profesional
  for each row execute function privado.validar_horario();

-- ---------------------------------------------------------------------------
-- Bloqueos: vacaciones, feriados, capacitación. Sin profesional = toda la clínica.
-- No se borran: se anulan con motivo.
-- ---------------------------------------------------------------------------
create table public.bloqueo_agenda (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.clinica (id),
  profesional_id    uuid,
  tipo              public.tipo_bloqueo not null,
  motivo            text not null check (char_length(btrim(motivo)) between 3 and 200),
  inicio            timestamptz not null,
  fin               timestamptz not null,
  creado_por        uuid default auth.uid(),
  anulado_at        timestamptz,
  anulado_por       uuid references public.usuario (id),
  motivo_anulacion  text,
  created_at        timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, profesional_id) references public.usuario (clinica_id, id),
  foreign key (clinica_id, creado_por)     references public.usuario (clinica_id, id),
  check (fin > inicio),
  constraint bloqueo_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null)),
  check (motivo_anulacion is null or char_length(btrim(motivo_anulacion)) >= 3)
);
alter table public.bloqueo_agenda enable row level security;
create index bloqueo_agenda_rango_idx on public.bloqueo_agenda (clinica_id, inicio, fin) where anulado_at is null;
create trigger solo_anular before update on public.bloqueo_agenda
  for each row execute function privado.solo_anular();
create trigger auditar after insert or update on public.bloqueo_agenda
  for each row execute function privado.auditar();

-- ---------------------------------------------------------------------------
-- Citas: sillón y forzado por el administrador (con motivo)
-- ---------------------------------------------------------------------------
alter table public.cita
  add column sillon_id      uuid,
  add column forzada_motivo text check (forzada_motivo is null or char_length(btrim(forzada_motivo)) between 3 and 200),
  add column forzada_por    uuid;
alter table public.cita
  add constraint cita_sillon_fk      foreign key (clinica_id, sillon_id)   references public.sillon (clinica_id, id),
  add constraint cita_forzada_por_fk foreign key (clinica_id, forzada_por) references public.usuario (clinica_id, id),
  add constraint cita_forzada_completa check ((forzada_motivo is null) = (forzada_por is null));
create index cita_odontologo_inicio_idx on public.cita (odontologo_id, inicio);
create index cita_sillon_inicio_idx on public.cita (sillon_id, inicio) where sillon_id is not null;

-- Las citas quedan en la auditoría (incluido quién forzó una cita y por qué).
create trigger auditar after insert or update on public.cita
  for each row execute function privado.auditar_simple();

-- Valida lo que agendan los usuarios de la app (rol authenticated). La historia que
-- cargan el seed o las migraciones, y la fusión de pacientes, no pasan por aquí.
create function privado.validar_agenda() returns trigger
language plpgsql set search_path = '' as $$
declare
  c_dias constant text[] := array['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
  c_activos constant public.estado_cita[] := array['programada', 'confirmada']::public.estado_cita[];
  v_admin boolean;
  v_tz text;
  v_ini timestamp;
  v_fin timestamp;
  v_dia int;
  v_profesional public.usuario;
  v_horario public.horario_profesional;
  v_bloqueo public.bloqueo_agenda;
  v_problema text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  v_admin := privado.rol_actual() is not distinct from 'admin';

  -- Quién forzó una cita lo pone solo esta función (nunca el cliente).
  if tg_op = 'INSERT' then
    new.forzada_por := null;
  elsif new.forzada_por is distinct from old.forzada_por then
    raise exception 'El autor de una cita forzada no se modifica' using hint = 'agenda';
  end if;

  -- Estados no activos (atendida, no asistió, cancelada): no se crean así ni se mueven.
  if not (new.estado = any (c_activos)) then
    if tg_op = 'INSERT' then
      raise exception 'Una cita nueva se agenda como programada o confirmada' using hint = 'agenda';
    end if;
    if new.inicio <> old.inicio or new.fin <> old.fin or new.odontologo_id <> old.odontologo_id
       or new.paciente_id <> old.paciente_id or new.sillon_id is distinct from old.sillon_id
       or new.forzada_motivo is distinct from old.forzada_motivo then
      raise exception 'Una cita atendida, cancelada o sin asistencia no cambia de fecha, profesional, paciente ni sillón'
        using hint = 'agenda';
    end if;
    if new.estado in ('atendida', 'no_asistio') and new.estado is distinct from old.estado and new.inicio > now() then
      raise exception 'No se marca como atendida o sin asistencia una cita que aún no empieza' using hint = 'agenda';
    end if;
    return new;
  end if;

  -- Confirmar o editar la nota de una cita activa no la vuelve a validar.
  if tg_op = 'UPDATE' and old.estado = any (c_activos)
     and new.inicio = old.inicio and new.fin = old.fin and new.odontologo_id = old.odontologo_id
     and new.paciente_id = old.paciente_id and new.sillon_id is not distinct from old.sillon_id
     and new.forzada_motivo is not distinct from old.forzada_motivo then
    return new;
  end if;

  select zona_horaria into v_tz from public.clinica where id = new.clinica_id;
  v_ini := new.inicio at time zone v_tz;
  v_fin := new.fin at time zone v_tz;
  if new.inicio < now() - interval '5 minutes' then
    raise exception 'No se puede agendar una cita en una hora que ya pasó' using hint = 'agenda';
  end if;
  if v_fin::date <> v_ini::date then
    raise exception 'La cita debe empezar y terminar el mismo día' using hint = 'agenda';
  end if;

  select * into v_profesional from public.usuario where id = new.odontologo_id;
  if not (v_profesional.activo and v_profesional.rol in ('admin', 'odontologo') and v_profesional.cop is not null) then
    raise exception 'Solo se agendan citas con odontólogos activos' using hint = 'agenda';
  end if;
  v_dia := extract(isodow from v_ini)::int;
  select * into v_horario from public.horario_profesional
   where profesional_id = new.odontologo_id and dia_semana = v_dia and activo;

  -- Sillón: el de su horario de ese día. Otro sillón solo lo elige el administrador.
  if v_horario.id is not null and (new.sillon_id is null or not v_admin) then
    new.sillon_id := v_horario.sillon_id;
  end if;
  if new.sillon_id is not null and not exists (select 1 from public.sillon where id = new.sillon_id and activo) then
    raise exception 'El sillón elegido no está activo' using hint = 'agenda';
  end if;

  -- Choques: nunca se fuerzan
  if exists (select 1 from public.cita c
              where c.clinica_id = new.clinica_id and c.id <> new.id and c.estado = any (c_activos)
                and c.odontologo_id = new.odontologo_id
                and tstzrange(c.inicio, c.fin) && tstzrange(new.inicio, new.fin)) then
    raise exception '% ya tiene otra cita en ese horario', v_profesional.nombre using hint = 'agenda';
  end if;
  if new.sillon_id is not null and exists (
       select 1 from public.cita c
        where c.clinica_id = new.clinica_id and c.id <> new.id and c.estado = any (c_activos)
          and c.sillon_id = new.sillon_id
          and tstzrange(c.inicio, c.fin) && tstzrange(new.inicio, new.fin)) then
    raise exception 'El sillón ya está ocupado en ese horario' using hint = 'agenda';
  end if;
  if exists (select 1 from public.cita c
              where c.clinica_id = new.clinica_id and c.id <> new.id and c.estado = any (c_activos)
                and c.paciente_id = new.paciente_id
                and tstzrange(c.inicio, c.fin) && tstzrange(new.inicio, new.fin)) then
    raise exception 'El paciente ya tiene otra cita en ese horario' using hint = 'agenda';
  end if;

  -- Horario y bloqueos: el administrador los puede forzar con motivo
  if v_horario.id is null then
    v_problema := format('%s no atiende los %s', v_profesional.nombre, c_dias[v_dia]);
  elsif v_ini::time < v_horario.hora_inicio or v_fin::time > v_horario.hora_fin then
    v_problema := format('Fuera del horario de %s: los %s atiende de %s a %s', v_profesional.nombre, c_dias[v_dia],
                         to_char(v_horario.hora_inicio, 'HH24:MI'), to_char(v_horario.hora_fin, 'HH24:MI'));
  end if;
  if v_problema is null then
    select * into v_bloqueo from public.bloqueo_agenda b
     where b.clinica_id = new.clinica_id and b.anulado_at is null
       and (b.profesional_id is null or b.profesional_id = new.odontologo_id)
       and tstzrange(b.inicio, b.fin) && tstzrange(new.inicio, new.fin)
     order by b.inicio limit 1;
    if v_bloqueo.id is not null then
      v_problema := format('Agenda bloqueada por %s: %s',
        case v_bloqueo.tipo when 'vacaciones' then 'vacaciones' when 'feriado' then 'feriado'
                            when 'capacitacion' then 'capacitación' else 'otro motivo' end,
        v_bloqueo.motivo);
    end if;
  end if;

  if v_problema is null then
    new.forzada_motivo := null;
    new.forzada_por := null;
  elsif coalesce(btrim(new.forzada_motivo), '') = '' then
    raise exception '%', v_problema using hint = 'agenda';
  elsif not v_admin then
    raise exception 'Solo el administrador puede agendar fuera del horario o sobre un bloqueo' using hint = 'agenda';
  else
    new.forzada_motivo := btrim(new.forzada_motivo);
    new.forzada_por := auth.uid();
  end if;
  return new;
end $$;
create trigger validar_agenda before insert or update on public.cita
  for each row execute function privado.validar_agenda();

-- ---------------------------------------------------------------------------
-- Guarda la semana de un profesional de una vez (todo o nada). Corre con los
-- permisos de quien llama: RLS exige que sea el administrador de la clínica.
-- dias: [{dia, activo, sillon_id, hora_inicio, hora_fin}, …]
-- ---------------------------------------------------------------------------
create function public.guardar_horario_semanal(profesional uuid, dias jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  d jsonb;
  v_clinica uuid := privado.clinica_actual();
  v_dia smallint;
  v_activo boolean;
begin
  if privado.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el administrador configura los horarios';
  end if;
  if jsonb_typeof(dias) <> 'array' then
    raise exception 'Horario inválido';
  end if;
  -- Primero se liberan los días que se apagan o cambian, para que un sillón se pueda
  -- reasignar en el mismo guardado sin chocar consigo mismo.
  for d in select * from jsonb_array_elements(dias) loop
    v_dia := (d ->> 'dia')::smallint;
    v_activo := coalesce((d ->> 'activo')::boolean, false);
    update public.horario_profesional set activo = false
     where profesional_id = profesional and dia_semana = v_dia and activo
       and (not v_activo or sillon_id is distinct from (d ->> 'sillon_id')::uuid
            or hora_inicio <> (d ->> 'hora_inicio')::time or hora_fin <> (d ->> 'hora_fin')::time);
  end loop;
  for d in select * from jsonb_array_elements(dias) loop
    v_dia := (d ->> 'dia')::smallint;
    if not coalesce((d ->> 'activo')::boolean, false) then
      continue;
    end if;
    update public.horario_profesional
       set sillon_id = (d ->> 'sillon_id')::uuid, hora_inicio = (d ->> 'hora_inicio')::time,
           hora_fin = (d ->> 'hora_fin')::time, activo = true
     where profesional_id = profesional and dia_semana = v_dia;
    if not found then
      insert into public.horario_profesional (clinica_id, profesional_id, sillon_id, dia_semana, hora_inicio, hora_fin)
      values (v_clinica, profesional, (d ->> 'sillon_id')::uuid, v_dia,
              (d ->> 'hora_inicio')::time, (d ->> 'hora_fin')::time);
    end if;
  end loop;
end $$;
revoke all on function public.guardar_horario_semanal(uuid, jsonb) from public, anon;
grant execute on function public.guardar_horario_semanal(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS y permisos: todo el equipo consulta; el administrador configura
-- ---------------------------------------------------------------------------
create policy sillon_select on public.sillon for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy sillon_insert on public.sillon for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');
create policy sillon_update on public.sillon for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (clinica_id = (select privado.clinica_actual()));

create policy horario_select on public.horario_profesional for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy horario_insert on public.horario_profesional for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');
create policy horario_update on public.horario_profesional for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (clinica_id = (select privado.clinica_actual()));

create policy bloqueo_select on public.bloqueo_agenda for select to authenticated
  using (clinica_id = (select privado.clinica_actual()));
create policy bloqueo_insert on public.bloqueo_agenda for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin'
              and creado_por = (select auth.uid()));
create policy bloqueo_anular on public.bloqueo_agenda for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

-- Supabase da todo a anon/authenticated en las tablas nuevas: se quita y se
-- concede solo lo necesario (regla 8).
revoke all on public.sillon, public.horario_profesional, public.bloqueo_agenda from anon, authenticated;
grant select, insert on public.sillon to authenticated;
grant update (nombre, activo) on public.sillon to authenticated;
grant select, insert on public.horario_profesional to authenticated;
grant update (sillon_id, hora_inicio, hora_fin, activo) on public.horario_profesional to authenticated;
-- cita: forzada_por lo asigna validar_agenda, nunca el cliente (permisos por columna).
revoke insert, update on public.cita from authenticated;
grant insert (id, clinica_id, paciente_id, odontologo_id, inicio, fin, estado, nota, sillon_id, forzada_motivo)
  on public.cita to authenticated;
grant update (paciente_id, odontologo_id, inicio, fin, estado, nota, sillon_id, forzada_motivo)
  on public.cita to authenticated;
grant select, insert on public.bloqueo_agenda to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.bloqueo_agenda to authenticated;
