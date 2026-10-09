-- Etapa 6 (v2): evolución clínica por sesión, firmada y con adendas, conectada a la cita.
-- Aditiva: columnas nuevas en nota_evolucion (la «nota» de la v1 pasa a ser la
-- evolución), tablas de ítems trabajados y adendas, el estado de cita «en sala».
--
-- Regla 2: la evolución firmada no se edita; solo admite adendas con fecha y autor.
-- Regla 3: un ítem realizado exige una evolución FIRMADA (el consentimiento, cuando
-- el procedimiento lo requiere, se exige en la Etapa 7).
-- Datos: las 132 notas existentes de la v1 quedan firmadas en su propia fecha.
-- Verificación: supabase/verificaciones/20261014000912_evolucion_firmada.sql

alter type public.estado_cita add value if not exists 'en_sala';

-- ---------------------------------------------------------------------------
-- Evolución (nota_evolucion ampliada)
-- ---------------------------------------------------------------------------
alter table public.nota_evolucion
  add column cita_id            uuid,
  add column anestesia_tipo     text check (char_length(anestesia_tipo) <= 100),
  add column anestesia_cantidad text check (char_length(anestesia_cantidad) <= 60),
  add column materiales         text check (char_length(materiales) <= 1000),
  add column incidencias        text check (char_length(incidencias) <= 1000),
  add column indicaciones       text check (char_length(indicaciones) <= 2000),
  add column proxima_cita       text check (char_length(proxima_cita) <= 200),
  add column firmada_at         timestamptz,
  add column updated_at         timestamptz not null default now();
alter table public.nota_evolucion
  add constraint nota_cita_fk foreign key (clinica_id, cita_id) references public.cita (clinica_id, id),
  add constraint nota_firmada_con_texto check (firmada_at is null or char_length(btrim(texto)) >= 3);
-- Una evolución vigente por cita.
create unique index nota_una_por_cita on public.nota_evolucion (cita_id) where cita_id is not null and anulado_at is null;
create index nota_paciente_idx on public.nota_evolucion (paciente_id, fecha desc);

-- Relleno: las notas de la v1 se escribieron ya cerradas.
alter table public.nota_evolucion disable trigger solo_anular;
update public.nota_evolucion set firmada_at = fecha where firmada_at is null;
alter table public.nota_evolucion enable trigger solo_anular;

-- Lo que carga el sistema (seed, migraciones) se registra ya firmado; lo que escribe
-- la app empieza como borrador. La cita es del mismo paciente.
create function privado.preparar_evolucion() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Carga del sistema (seed, migraciones): ya firmada. Desde la app o desde
  -- abrir_evolucion() (en_proceso): nace en borrador, con la fecha de hoy.
  if current_user <> 'authenticated' and not privado.en_proceso() then
    new.firmada_at := coalesce(new.firmada_at, new.fecha);
  else
    new.firmada_at := null;
    new.fecha := now();
  end if;
  if new.cita_id is not null
     and not exists (select 1 from public.cita c where c.id = new.cita_id and c.paciente_id = new.paciente_id) then
    raise exception 'La cita no corresponde a este paciente';
  end if;
  return new;
end $$;
create trigger preparar before insert on public.nota_evolucion
  for each row execute function privado.preparar_evolucion();

-- Borrador: lo edita solo su autor (el contenido; no el paciente, la cita ni el autor).
-- Firmada: solo se anula (con motivo), como antes. La firma la pone firmar_evolucion().
create or replace function privado.proteger_evolucion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.en_fusion() and (to_jsonb(new) - 'paciente_id') = (to_jsonb(old) - 'paciente_id') then
    return new;
  end if;
  if old.anulado_at is not null then
    raise exception 'La evolución está anulada y no puede modificarse';
  end if;
  if new.anulado_at is not null then
    if new.anulado_por is distinct from auth.uid() then
      raise exception 'Solo se anula a nombre propio, con motivo';
    end if;
    if old.firmada_at is not null
       and exists (select 1 from public.item_plan i where i.nota_evolucion_id = old.id and i.estado = 'realizado') then
      raise exception 'Esta evolución respalda ítems realizados: agrega una adenda en lugar de anularla';
    end if;
    if old.firmada_at is not null and (to_jsonb(new) - array['anulado_at', 'anulado_por', 'motivo_anulacion', 'updated_at'])
       is distinct from (to_jsonb(old) - array['anulado_at', 'anulado_por', 'motivo_anulacion', 'updated_at']) then
      raise exception 'Una evolución firmada no se edita: agrega una adenda';
    end if;
    new.anulado_at := now();
    return new;
  end if;
  if old.firmada_at is not null then
    if current_user <> 'authenticated' and new.firmada_at is not distinct from old.firmada_at
       and (to_jsonb(new) - array['updated_at']) = (to_jsonb(old) - array['updated_at']) then
      return new;
    end if;
    raise exception 'Una evolución firmada no se edita: agrega una adenda';
  end if;
  if new.firmada_at is not null and current_user = 'authenticated' then
    raise exception 'La evolución se firma con «Firmar y cerrar»';
  end if;
  if old.odontologo_id is distinct from auth.uid() and current_user = 'authenticated' then
    raise exception 'Solo el autor edita su evolución en borrador';
  end if;
  if new.paciente_id is distinct from old.paciente_id or new.odontologo_id is distinct from old.odontologo_id
     or new.cita_id is distinct from old.cita_id or new.clinica_id is distinct from old.clinica_id then
    raise exception 'El paciente, la cita y el autor de la evolución no cambian';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger solo_anular on public.nota_evolucion;
create trigger proteger before update on public.nota_evolucion
  for each row execute function privado.proteger_evolucion();

-- Regla 3: realizado = evolución FIRMADA (antes bastaba una nota vigente).
create or replace function privado.validar_item() returns trigger
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
        and n.firmada_at is not null
    ) then
      raise exception 'Un ítem se marca realizado con una evolución firmada, del mismo paciente y vigente';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Ítems trabajados en la sesión
-- ---------------------------------------------------------------------------
create table public.evolucion_item (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null,
  nota_id     uuid not null,
  item_id     uuid not null,
  -- Sin DELETE (regla 8): si se marcó por error, se desmarca «trabajado».
  trabajado   boolean not null default true,
  -- Si en esta sesión el ítem quedó terminado (al firmar se marca realizado).
  terminado   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (nota_id, item_id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, item_id) references public.item_plan (clinica_id, id)
);
alter table public.evolucion_item enable row level security;

create function privado.validar_evolucion_item() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.nota_evolucion n
                  join public.item_plan i on i.id = new.item_id
                  join public.plan_tratamiento p on p.id = i.plan_id and p.paciente_id = n.paciente_id
                 where n.id = new.nota_id and n.firmada_at is null and n.anulado_at is null
                   and i.estado in ('aceptado', 'programado')) then
    raise exception 'Solo se agregan ítems aceptados del mismo paciente a una evolución en borrador';
  end if;
  return new;
end $$;
create trigger validar before insert or update on public.evolucion_item
  for each row execute function privado.validar_evolucion_item();

-- ---------------------------------------------------------------------------
-- Adendas (después de firmar): texto, fecha y autor; no se editan ni se borran
-- ---------------------------------------------------------------------------
create table public.evolucion_adenda (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  nota_id         uuid not null,
  texto           text not null check (char_length(btrim(texto)) between 3 and 2000),
  registrado_por  uuid default auth.uid(),
  registrado_at   timestamptz not null default now(),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id)
);
alter table public.evolucion_adenda enable row level security;
create function privado.validar_evolucion_adenda() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.nota_evolucion n where n.id = new.nota_id and n.firmada_at is not null
                   and n.anulado_at is null) then
    raise exception 'Las adendas se agregan a una evolución firmada y vigente';
  end if;
  new.registrado_at := now();
  return new;
end $$;
create trigger validar before insert on public.evolucion_adenda
  for each row execute function privado.validar_evolucion_adenda();
create trigger auditar after insert on public.evolucion_adenda
  for each row execute function privado.auditar_simple();

-- ---------------------------------------------------------------------------
-- Firmar y cerrar: la firma la pone el servidor; los ítems marcados como terminados
-- pasan a realizado con esta evolución (se validan el orden del plan y la regla 3)
-- y la cita queda atendida.
-- ---------------------------------------------------------------------------
create function public.firmar_evolucion(id_nota uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_nota public.nota_evolucion;
begin
  select * into v_nota from public.nota_evolucion
   where id = id_nota and clinica_id = privado.clinica_actual() for update;
  if v_nota.id is null then
    raise exception 'Evolución no encontrada';
  end if;
  if not privado.es_dentista() or v_nota.odontologo_id is distinct from auth.uid() then
    raise exception 'Solo el cirujano dentista autor firma su evolución';
  end if;
  if v_nota.anulado_at is not null then
    raise exception 'La evolución está anulada';
  end if;
  if v_nota.firmada_at is not null then
    raise exception 'La evolución ya está firmada';
  end if;
  if char_length(btrim(v_nota.texto)) < 3 then
    raise exception 'Escribe la descripción de lo realizado antes de firmar';
  end if;

  perform set_config('dental.proceso', 'on', true);
  update public.nota_evolucion set firmada_at = now(), fecha = now() where id = id_nota;
  -- Los ítems terminados, en el orden del plan (validar_item y validar_item_dependencias
  -- corren igual: un ítem que requiere otro no realizado hace fallar toda la firma).
  update public.item_plan i set estado = 'realizado', realizado_at = now(), nota_evolucion_id = id_nota
    from public.evolucion_item e
   where e.nota_id = id_nota and e.trabajado and e.terminado and e.item_id = i.id and i.estado in ('aceptado', 'programado');
  -- La cita de la sesión queda atendida.
  update public.cita set estado = 'atendida'
   where id = v_nota.cita_id and estado in ('programada', 'confirmada', 'en_sala') and inicio <= now();
  perform set_config('dental.proceso', 'off', true);
end $$;
revoke all on function public.firmar_evolucion(uuid) from public, anon;
grant execute on function public.firmar_evolucion(uuid) to authenticated;

-- Abrir la evolución de una cita (botón «Atender»): la crea en borrador si no existe
-- y la devuelve. La cita queda «en sala» si aún estaba programada o confirmada.
create function public.abrir_evolucion(id_cita uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_cita public.cita;
  v_nota uuid;
begin
  if not privado.es_dentista() then
    raise exception 'Solo el cirujano dentista atiende y escribe la evolución';
  end if;
  select * into v_cita from public.cita where id = id_cita and clinica_id = privado.clinica_actual() for update;
  if v_cita.id is null then
    raise exception 'Cita no encontrada';
  end if;
  if v_cita.estado not in ('programada', 'confirmada', 'en_sala', 'atendida') then
    raise exception 'Esta cita está cancelada o el paciente no asistió';
  end if;
  if (v_cita.inicio at time zone 'America/Lima')::date > (now() at time zone 'America/Lima')::date then
    raise exception 'La cita es de otro día: se atiende el día de la cita';
  end if;
  select id into v_nota from public.nota_evolucion where cita_id = id_cita and anulado_at is null;
  if v_nota is null then
    -- Como el usuario (no como sistema): nace en borrador y a su nombre.
    perform set_config('dental.proceso', 'on', true);
    insert into public.nota_evolucion (clinica_id, paciente_id, odontologo_id, texto, cita_id)
    values (v_cita.clinica_id, v_cita.paciente_id, auth.uid(), '', id_cita)
    returning id into v_nota;
    perform set_config('dental.proceso', 'off', true);
    -- Ítems ya vinculados a la cita: se proponen como trabajados en la sesión.
    insert into public.evolucion_item (clinica_id, nota_id, item_id)
    select v_cita.clinica_id, v_nota, ci.item_plan_id from public.cita_item ci
      join public.item_plan i on i.id = ci.item_plan_id and i.estado in ('aceptado', 'programado')
     where ci.cita_id = id_cita
    on conflict do nothing;
  end if;
  if v_cita.estado in ('programada', 'confirmada') and (v_cita.inicio at time zone 'America/Lima')::date
       = (now() at time zone 'America/Lima')::date then
    update public.cita set estado = 'en_sala' where id = id_cita;
  end if;
  return v_nota;
end $$;
revoke all on function public.abrir_evolucion(uuid) from public, anon;
grant execute on function public.abrir_evolucion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Agenda: «en sala» cuenta como cita activa (choques) y solo el día de la cita.
-- ---------------------------------------------------------------------------
create or replace function privado.validar_agenda() returns trigger
language plpgsql set search_path = '' as $$
declare
  c_dias constant text[] := array['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
  c_activos constant public.estado_cita[] := array['programada', 'confirmada', 'en_sala']::public.estado_cita[];
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

  -- «En sala»: el paciente llegó; solo el día de la cita.
  if new.estado = 'en_sala' and (tg_op = 'INSERT' or old.estado <> 'en_sala')
     and (new.inicio at time zone 'America/Lima')::date <> (now() at time zone 'America/Lima')::date then
    raise exception 'Solo se marca «en sala» el día de la cita' using hint = 'agenda';
  end if;
  if tg_op = 'INSERT' and new.estado = 'en_sala' then
    raise exception 'Una cita nueva se agenda como programada o confirmada' using hint = 'agenda';
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

-- ---------------------------------------------------------------------------
-- RLS: ven dentistas y asistente; escribe el cirujano dentista (a nombre propio).
-- ---------------------------------------------------------------------------
drop policy nota_anular on public.nota_evolucion;
create policy nota_update on public.nota_evolucion for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual())
              and (anulado_por = (select auth.uid())
                   or (anulado_at is null and odontologo_id = (select auth.uid()))));
grant update (texto, cie10, anestesia_tipo, anestesia_cantidad, materiales, incidencias, indicaciones, proxima_cita)
  on public.nota_evolucion to authenticated;
grant insert (id, clinica_id, paciente_id, odontologo_id, texto, cie10, cita_id, anestesia_tipo, anestesia_cantidad,
              materiales, incidencias, indicaciones, proxima_cita)
  on public.nota_evolucion to authenticated;

create policy evolucion_item_select on public.evolucion_item for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy evolucion_item_insert on public.evolucion_item for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
              and exists (select 1 from public.nota_evolucion n where n.id = nota_id and n.odontologo_id = (select auth.uid())));
create policy evolucion_item_update on public.evolucion_item for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
         and exists (select 1 from public.nota_evolucion n where n.id = nota_id and n.odontologo_id = (select auth.uid())))
  with check (clinica_id = (select privado.clinica_actual()));

create policy evolucion_adenda_select on public.evolucion_adenda for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy evolucion_adenda_insert on public.evolucion_adenda for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista())
              and registrado_por = (select auth.uid()));

revoke all on public.evolucion_item, public.evolucion_adenda from anon, authenticated;
grant select, insert on public.evolucion_item to authenticated;
grant update (trabajado, terminado) on public.evolucion_item to authenticated;
grant select on public.evolucion_adenda to authenticated;
grant insert (id, clinica_id, nota_id, texto, registrado_por) on public.evolucion_adenda to authenticated;

-- Auditoría: adendas y lista de ítems son contenido clínico (regla 9).
drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica', 'examen_clinico', 'diagnostico',
                            'diagnostico_adenda', 'evolucion_adenda', 'evolucion_item')
              or (select privado.es_dentista())));
