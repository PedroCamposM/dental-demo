-- Etapa 20 (v2): turnos de caja. Para el cambio de turno: se abre la caja con un fondo
-- inicial y se cierra el turno contando el efectivo (fondo + cobros en efectivo del turno).
-- Puede haber varios turnos al día, uno abierto a la vez. El cierre de caja diario se
-- mantiene igual (resumen del día, efectivo de los pagos sin el fondo, ajustes con motivo);
-- solo se exige cerrar antes el turno abierto.
--
-- Aditiva: tabla turno_caja (clinica_id, RLS, auditoría, solo lectura al vencer) y columna
-- pago.turno_id (los pagos se asignan solos al turno abierto). Abrir un turno es opcional: la
-- clínica que no usa turnos sigue registrando pagos y cerrando el día como hasta ahora.

create table public.turno_caja (
  id                  uuid primary key default gen_random_uuid(),
  clinica_id          uuid not null references public.clinica (id),
  fecha               date not null,  -- día (Lima) en que se abrió
  fondo_centimos      bigint not null check (fondo_centimos between 0 and 10000000),
  abierto_por         uuid not null,
  abierto_at          timestamptz not null default now(),
  -- Al cerrar (todo junto, una sola vez): resumen, efectivo esperado y contado, diferencia.
  por_metodo          jsonb,
  total_centimos      bigint check (total_centimos >= 0),
  pagos               integer check (pagos >= 0),
  efectivo_esperado   bigint check (efectivo_esperado >= 0),
  efectivo_contado    bigint check (efectivo_contado >= 0),
  diferencia_centimos bigint,
  observaciones       text check (char_length(observaciones) <= 500),
  cerrado_por         uuid,
  cerrado_at          timestamptz,
  unique (clinica_id, id),
  foreign key (clinica_id, abierto_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, cerrado_por) references public.usuario (clinica_id, id),
  constraint turno_caja_cierre_completo check (
    (cerrado_at is null and cerrado_por is null and efectivo_contado is null and diferencia_centimos is null and por_metodo is null)
    or (cerrado_at is not null and cerrado_por is not null and efectivo_contado is not null and efectivo_esperado is not null
        and diferencia_centimos is not null and por_metodo is not null and total_centimos is not null and pagos is not null))
);
-- Un solo turno abierto por clínica.
create unique index turno_caja_un_abierto on public.turno_caja (clinica_id) where cerrado_at is null;
create index turno_caja_fecha on public.turno_caja (clinica_id, fecha);
alter table public.turno_caja enable row level security;

alter table public.pago add column turno_id uuid;
alter table public.pago add constraint pago_turno_fk foreign key (clinica_id, turno_id) references public.turno_caja (clinica_id, id);
create index pago_turno on public.pago (turno_id) where turno_id is not null;

create trigger auditar after insert or update on public.turno_caja for each row execute function privado.auditar_simple();
-- Vencida o suspendida: no se abren ni cierran turnos (como todo registro nuevo).
create trigger a_solo_lectura before insert or update or delete on public.turno_caja
  for each row execute function privado.solo_lectura_si_vencida();

-- Un turno no se reabre ni se cambia después de cerrado (lo exige la base, no solo la app).
create function privado.turno_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.cerrado_at is not null then
    raise exception 'El turno ya se cerró: no se reabre ni se modifica';
  end if;
  if new.fondo_centimos <> old.fondo_centimos or new.abierto_por <> old.abierto_por or new.abierto_at <> old.abierto_at
     or new.fecha <> old.fecha or new.clinica_id <> old.clinica_id then
    raise exception 'La apertura del turno no se modifica';
  end if;
  return new;
end $$;
create trigger inmutable before update on public.turno_caja for each row execute function privado.turno_inmutable();

-- Resumen de los pagos (vigentes) de un turno.
create function privado.resumen_turno(id_turno uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with p as (select monto_centimos, metodo from public.pago where turno_id = id_turno and anulado_at is null)
  select jsonb_build_object(
    'total_centimos', coalesce((select sum(monto_centimos) from p), 0),
    'pagos', (select count(*) from p),
    'por_metodo', coalesce((select jsonb_object_agg(metodo, total) from
                   (select metodo, sum(monto_centimos) as total from p group by metodo) m), '{}'::jsonb))
$$;
revoke all on function privado.resumen_turno(uuid) from public, anon, authenticated;

create function public.abrir_turno(fondo bigint, observaciones text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  v_clinica uuid := privado.clinica_actual();
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_id uuid;
begin
  if privado.rol_actual() not in ('admin', 'recepcion') then
    raise exception 'Los turnos de caja los abren administración o recepción';
  end if;
  if fondo is null or fondo < 0 or fondo > 10000000 then
    raise exception 'Indica el fondo inicial (0 o más)';
  end if;
  -- Mismo bloqueo que los pagos y el cierre del día.
  perform pg_advisory_xact_lock(hashtext('caja:' || v_clinica::text));
  if exists (select 1 from public.turno_caja where clinica_id = v_clinica and cerrado_at is null) then
    raise exception 'Ya hay un turno abierto: ciérralo antes de abrir otro';
  end if;
  if exists (select 1 from public.cierre_caja where clinica_id = v_clinica and fecha = v_hoy) then
    raise exception 'La caja de hoy ya se cerró: no se abren más turnos';
  end if;
  insert into public.turno_caja (clinica_id, fecha, fondo_centimos, abierto_por, observaciones)
  values (v_clinica, v_hoy, fondo, auth.uid(), nullif(left(btrim(observaciones), 500), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.abrir_turno(bigint, text) from public, anon;
grant execute on function public.abrir_turno(bigint, text) to authenticated;

-- Cierra el turno abierto: efectivo esperado = fondo + cobros en efectivo del turno.
create function public.cerrar_turno(efectivo_contado bigint, observaciones text) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  v_clinica uuid := privado.clinica_actual();
  v_turno public.turno_caja;
  v_resumen jsonb;
  v_esperado bigint;
begin
  if privado.rol_actual() not in ('admin', 'recepcion') then
    raise exception 'Los turnos de caja los cierran administración o recepción';
  end if;
  if efectivo_contado is null or efectivo_contado < 0 or efectivo_contado > 100000000 then
    raise exception 'Indica el efectivo contado';
  end if;
  perform pg_advisory_xact_lock(hashtext('caja:' || v_clinica::text));
  select * into v_turno from public.turno_caja where clinica_id = v_clinica and cerrado_at is null for update;
  if v_turno.id is null then
    raise exception 'No hay un turno abierto';
  end if;
  v_resumen := privado.resumen_turno(v_turno.id);
  v_esperado := v_turno.fondo_centimos + coalesce((v_resumen -> 'por_metodo' ->> 'efectivo')::bigint, 0);
  update public.turno_caja set
    por_metodo = v_resumen -> 'por_metodo', total_centimos = (v_resumen ->> 'total_centimos')::bigint,
    pagos = (v_resumen ->> 'pagos')::int, efectivo_esperado = v_esperado, efectivo_contado = efectivo_contado,
    diferencia_centimos = efectivo_contado - v_esperado,
    observaciones = coalesce(nullif(left(btrim(observaciones), 500), ''), v_turno.observaciones),
    cerrado_por = auth.uid(), cerrado_at = now()
  where id = v_turno.id;
  return v_turno.id;
end $$;
revoke all on function public.cerrar_turno(bigint, text) from public, anon;
grant execute on function public.cerrar_turno(bigint, text) to authenticated;

-- El turno abierto con lo cobrado hasta ahora (para la pantalla de caja).
create function public.turno_abierto()
returns table (id uuid, fecha date, fondo_centimos bigint, abierto_por uuid, abierto_at timestamptz, resumen jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if privado.rol_actual() not in ('admin', 'recepcion') then
    raise exception 'La caja la ven administración y recepción';
  end if;
  return query
    select t.id, t.fecha, t.fondo_centimos, t.abierto_por, t.abierto_at, privado.resumen_turno(t.id)
      from public.turno_caja t where t.clinica_id = privado.clinica_actual() and t.cerrado_at is null;
end $$;
revoke all on function public.turno_abierto() from public, anon;
grant execute on function public.turno_abierto() to authenticated;

-- Los pagos se asignan al turno abierto (dentro del mismo bloqueo que el cierre).
create or replace function privado.validar_pago_caja() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('caja:' || new.clinica_id::text));
  if tg_op = 'INSERT' and privado.dia_cerrado(new.clinica_id, new.pagado_at) then
    raise exception 'La caja de ese día ya se cerró: registra un ajuste con motivo';
  end if;
  if tg_op = 'INSERT' then
    new.turno_id := (select t.id from public.turno_caja t where t.clinica_id = new.clinica_id and t.cerrado_at is null);
  end if;
  if tg_op = 'UPDATE' and new.turno_id is distinct from old.turno_id then
    raise exception 'El turno de un pago no se cambia';
  end if;
  if tg_op = 'UPDATE' and new.anulado_at is not null and old.anulado_at is null
     and privado.dia_cerrado(old.clinica_id, old.pagado_at) then
    raise exception 'La caja de ese día ya se cerró: el pago no se anula, se registra un ajuste con motivo';
  end if;
  return new;
end $$;

-- El cierre del día exige que no quede un turno abierto de ese día (o de antes).
create or replace function public.cerrar_caja(dia date, efectivo_contado bigint, observaciones text)
returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  v_clinica uuid := privado.clinica_actual();
  v_resumen jsonb;
  v_esperado bigint;
  v_id uuid;
begin
  if privado.rol_actual() not in ('admin', 'recepcion') then
    raise exception 'La caja la cierran administración o recepción';
  end if;
  if dia is null or dia > (now() at time zone 'America/Lima')::date then
    raise exception 'No se cierra la caja de un día que aún no llega';
  end if;
  if efectivo_contado is null or efectivo_contado < 0 then
    raise exception 'Indica el efectivo contado';
  end if;
  -- Bloquea los pagos de la clínica para que nadie registre uno mientras se cierra.
  perform pg_advisory_xact_lock(hashtext('caja:' || v_clinica::text));
  if exists (select 1 from public.cierre_caja where clinica_id = v_clinica and fecha = dia) then
    raise exception 'La caja de ese día ya está cerrada';
  end if;
  if exists (select 1 from public.turno_caja where clinica_id = v_clinica and cerrado_at is null and fecha <= dia) then
    raise exception 'Hay un turno de caja abierto: ciérralo antes de cerrar la caja del día';
  end if;
  v_resumen := public.resumen_caja(dia);
  v_esperado := coalesce((v_resumen -> 'por_metodo' ->> 'efectivo')::bigint, 0);
  insert into public.cierre_caja (clinica_id, fecha, por_metodo, por_profesional, total_centimos, pagos,
                                  efectivo_esperado, efectivo_contado, diferencia_centimos, observaciones, cerrado_por)
  values (v_clinica, dia, v_resumen -> 'por_metodo', v_resumen -> 'por_profesional',
          (v_resumen ->> 'total_centimos')::bigint, (v_resumen ->> 'pagos')::int, v_esperado, efectivo_contado,
          efectivo_contado - v_esperado, nullif(left(btrim(observaciones), 500), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- RLS: administración y recepción ven los turnos; se escriben solo por las funciones.
create policy turno_caja_select on public.turno_caja for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) in ('admin', 'recepcion'));
revoke all on public.turno_caja from public, anon, authenticated;
grant select on public.turno_caja to authenticated;
