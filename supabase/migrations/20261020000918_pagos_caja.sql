-- Etapa 8 (v2), rebanada 2: registrar pagos desde la app y cierre de caja diario.
--
-- Aditiva:
-- - registrar_pago(): registra el pago y lo aplica en una sola operación (a las cuotas
--   pendientes en orden, o, sin cuotas, a los ítems: primero lo realizado). Montos en
--   céntimos (regla 7).
-- - cierre_caja: resumen del día por método y por profesional, efectivo contado y
--   diferencia. Una vez cerrado el día, sus pagos no se registran ni se anulan.
-- - ajuste_caja: la corrección de un día cerrado, con motivo (no se editan pagos).
-- Lo hacen administración y recepción (como los pagos de la v1).

-- ---------------------------------------------------------------------------
-- Cierre de caja
-- ---------------------------------------------------------------------------
create table public.cierre_caja (
  id                  uuid primary key default gen_random_uuid(),
  clinica_id          uuid not null references public.clinica (id),
  fecha               date not null,
  -- {"efectivo": 12000, "yape": 5000, ...} y [{"profesional_id", "nombre", "centimos"}]
  por_metodo          jsonb not null,
  por_profesional     jsonb not null,
  total_centimos      bigint not null check (total_centimos >= 0),
  pagos               integer not null check (pagos >= 0),
  efectivo_esperado   bigint not null check (efectivo_esperado >= 0),
  efectivo_contado    bigint not null check (efectivo_contado >= 0),
  diferencia_centimos bigint not null,
  observaciones       text check (char_length(observaciones) <= 500),
  cerrado_por         uuid not null,
  cerrado_at          timestamptz not null default now(),
  unique (clinica_id, fecha),
  unique (clinica_id, id),
  foreign key (clinica_id, cerrado_por) references public.usuario (clinica_id, id)
);
alter table public.cierre_caja enable row level security;

create table public.ajuste_caja (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  cierre_id       uuid not null,
  pago_id         uuid,
  metodo          public.metodo_pago not null,
  -- Positivo: ingreso no registrado; negativo: lo registrado de más o en otro método.
  monto_centimos  integer not null check (monto_centimos <> 0 and abs(monto_centimos) <= 10000000),
  motivo          text not null check (char_length(btrim(motivo)) between 5 and 300),
  registrado_por  uuid not null,
  registrado_at   timestamptz not null default now(),
  foreign key (clinica_id, cierre_id) references public.cierre_caja (clinica_id, id),
  foreign key (clinica_id, pago_id) references public.pago (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id)
);
alter table public.ajuste_caja enable row level security;
create trigger auditar after insert on public.cierre_caja for each row execute function privado.auditar_simple();
create trigger auditar after insert on public.ajuste_caja for each row execute function privado.auditar_simple();

create function privado.dia_cerrado(clinica uuid, instante timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cierre_caja c
                  where c.clinica_id = clinica and c.fecha = (instante at time zone 'America/Lima')::date)
$$;

-- ---------------------------------------------------------------------------
-- Registrar un pago y aplicarlo
-- ---------------------------------------------------------------------------
create function public.registrar_pago(id_plan uuid, monto integer, metodo public.metodo_pago, referencia text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_tratamiento;
  v_pago uuid;
  v_resta integer := monto;
  v_tiene_cuotas boolean;
  r record;
  v_aplica integer;
begin
  if privado.rol_actual() not in ('admin', 'recepcion') then
    raise exception 'Los pagos los registra administración o recepción';
  end if;
  if monto is null or monto <= 0 or monto > 10000000 then
    raise exception 'El monto debe ser mayor que cero';
  end if;
  select * into v_plan from public.plan_tratamiento where id = id_plan and clinica_id = privado.clinica_actual() for update;
  if v_plan.id is null then
    raise exception 'Plan no encontrado';
  end if;
  if v_plan.estado not in ('aceptado', 'en_curso', 'detenido', 'terminado') then
    raise exception 'Solo se cobra un plan aceptado';
  end if;
  insert into public.pago (clinica_id, plan_id, monto_centimos, metodo, referencia, registrado_por)
  values (v_plan.clinica_id, v_plan.id, monto, metodo, nullif(left(btrim(referencia), 80), ''), auth.uid())
  returning id into v_pago;

  v_tiene_cuotas := exists (select 1 from public.cuota where plan_id = v_plan.id);
  if v_tiene_cuotas then
    for r in select cuota_id, saldo_centimos from public.v_cuota_saldo
              where plan_id = v_plan.id and saldo_centimos > 0 order by numero loop
      exit when v_resta = 0;
      v_aplica := least(v_resta, r.saldo_centimos);
      insert into public.pago_aplicacion (clinica_id, pago_id, cuota_id, monto_centimos)
      values (v_plan.clinica_id, v_pago, r.cuota_id, v_aplica);
      v_resta := v_resta - v_aplica;
    end loop;
  else
    for r in select c.item_plan_id, c.saldo_centimos from public.v_item_cobro c
               join public.item_plan i on i.id = c.item_plan_id
              where c.plan_id = v_plan.id and c.saldo_centimos > 0 and c.estado <> 'cancelado'
              order by (c.estado = 'realizado') desc, i.fase nulls first, i.orden loop
      exit when v_resta = 0;
      v_aplica := least(v_resta, r.saldo_centimos);
      insert into public.pago_aplicacion (clinica_id, pago_id, item_plan_id, monto_centimos)
      values (v_plan.clinica_id, v_pago, r.item_plan_id, v_aplica);
      v_resta := v_resta - v_aplica;
    end loop;
  end if;
  if v_resta > 0 then
    raise exception 'El pago excede el saldo del plan (sobran %)', to_char(v_resta / 100.0, 'FM999G999G990D00');
  end if;
  return v_pago;
end $$;
revoke all on function public.registrar_pago(uuid, integer, public.metodo_pago, text) from public, anon;
grant execute on function public.registrar_pago(uuid, integer, public.metodo_pago, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Resumen y cierre del día
-- ---------------------------------------------------------------------------
create function public.resumen_caja(dia date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
begin
  if privado.rol_actual() not in ('admin', 'recepcion') then
    raise exception 'La caja la ven administración y recepción';
  end if;
  return (
    with pagos as (
      select p.id, p.monto_centimos, p.metodo, pl.odontologo_id
        from public.pago p join public.plan_tratamiento pl on pl.id = p.plan_id
       where p.clinica_id = v_clinica and p.anulado_at is null
         and (p.pagado_at at time zone 'America/Lima')::date = dia
    )
    select jsonb_build_object(
      'total_centimos', coalesce((select sum(monto_centimos) from pagos), 0),
      'pagos', (select count(*) from pagos),
      'por_metodo', coalesce((select jsonb_object_agg(metodo, total) from
                     (select metodo, sum(monto_centimos) as total from pagos group by metodo) m), '{}'::jsonb),
      'por_profesional', coalesce((select jsonb_agg(jsonb_build_object('profesional_id', x.odontologo_id,
                          'nombre', u.nombre, 'centimos', x.total) order by x.total desc)
                       from (select odontologo_id, sum(monto_centimos) as total from pagos group by odontologo_id) x
                       left join public.usuario u on u.id = x.odontologo_id), '[]'::jsonb)
    )
  );
end $$;
revoke all on function public.resumen_caja(date) from public, anon;
grant execute on function public.resumen_caja(date) to authenticated;

create function public.cerrar_caja(dia date, efectivo_contado bigint, observaciones text)
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
revoke all on function public.cerrar_caja(date, bigint, text) from public, anon;
grant execute on function public.cerrar_caja(date, bigint, text) to authenticated;

-- Un día cerrado no recibe pagos nuevos ni anulaciones: se corrige con un ajuste. Toma el
-- mismo bloqueo que el cierre (un pago no se cuela mientras se cierra la caja).
create function privado.validar_pago_caja() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('caja:' || new.clinica_id::text));
  if tg_op = 'INSERT' and privado.dia_cerrado(new.clinica_id, new.pagado_at) then
    raise exception 'La caja de ese día ya se cerró: registra un ajuste con motivo';
  end if;
  if tg_op = 'UPDATE' and new.anulado_at is not null and old.anulado_at is null
     and privado.dia_cerrado(old.clinica_id, old.pagado_at) then
    raise exception 'La caja de ese día ya se cerró: el pago no se anula, se registra un ajuste con motivo';
  end if;
  return new;
end $$;
create trigger validar_caja before insert or update on public.pago
  for each row execute function privado.validar_pago_caja();

-- Ajuste de un día cerrado (con motivo)
create function privado.preparar_ajuste() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.registrado_por := auth.uid();
    new.registrado_at := now();
  end if;
  if new.pago_id is not null and not exists (
       select 1 from public.pago p join public.cierre_caja c on c.id = new.cierre_id
        where p.id = new.pago_id and p.clinica_id = c.clinica_id
          and (p.pagado_at at time zone 'America/Lima')::date = c.fecha) then
    raise exception 'El pago no es del día de ese cierre';
  end if;
  return new;
end $$;
create trigger preparar before insert on public.ajuste_caja for each row execute function privado.preparar_ajuste();

-- ---------------------------------------------------------------------------
-- RLS: administración y recepción. Sin UPDATE ni DELETE (el cierre no se reabre).
-- ---------------------------------------------------------------------------
create policy cierre_caja_select on public.cierre_caja for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) in ('admin', 'recepcion'));
create policy ajuste_caja_select on public.ajuste_caja for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) in ('admin', 'recepcion'));
create policy ajuste_caja_insert on public.ajuste_caja for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) in ('admin', 'recepcion')
              and registrado_por = (select auth.uid()));
revoke all on public.cierre_caja, public.ajuste_caja from anon, authenticated;
grant select on public.cierre_caja, public.ajuste_caja to authenticated;
grant insert (id, clinica_id, cierre_id, pago_id, metodo, monto_centimos, motivo, registrado_por) on public.ajuste_caja to authenticated;
