-- Cuotas, pagos y aplicación de pagos
-- Origen: docs/propuesta-esquema.sql (v2, aprobada).

-- ---------------------------------------------------------------------------
-- Cuotas y pagos
--   pago            = un movimiento de dinero con UN método (Yape, efectivo…).
--                     Pago mixto = varios pagos.
--   pago_aplicacion = cómo se reparte ese pago entre ítems y/o cuotas.
--                     Lo no aplicado queda como adelanto del plan.
--   Nada se edita: para corregir se anula el pago y se registra de nuevo.
-- ---------------------------------------------------------------------------
create table public.cuota (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  plan_id         uuid not null,
  numero          smallint not null check (numero >= 1),
  monto_centimos  integer not null check (monto_centimos > 0),
  vence_el        date not null,
  created_at      timestamptz not null default now(),
  unique (clinica_id, id),
  unique (plan_id, numero),
  foreign key (clinica_id, plan_id) references public.plan_tratamiento (clinica_id, id)
);

create table public.pago (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  plan_id          uuid not null,
  monto_centimos   integer not null check (monto_centimos > 0),
  metodo           public.metodo_pago not null,
  pagado_at        timestamptz not null default now(),
  referencia       text,              -- nº de operación Yape/Plin/transferencia/voucher
  registrado_por   uuid not null,
  anulado_at       timestamptz,
  anulado_por      uuid references public.usuario (id),
  motivo_anulacion text,
  created_at       timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, plan_id)        references public.plan_tratamiento (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  constraint pago_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null))
);

create table public.pago_aplicacion (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  pago_id         uuid not null,
  item_plan_id    uuid,
  cuota_id        uuid,
  monto_centimos  integer not null check (monto_centimos > 0),
  created_at      timestamptz not null default now(),
  foreign key (clinica_id, pago_id)      references public.pago (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, cuota_id)     references public.cuota (clinica_id, id),
  constraint aplicacion_con_destino check (item_plan_id is not null or cuota_id is not null)
);

-- Evita sobreaplicar: pago, ítem y cuota nunca reciben más de su monto.
-- Bloquea las filas involucradas para que dos cajas a la vez no se pisen.
create function privado.validar_aplicacion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pago  public.pago;
  v_item  public.item_plan;
  v_cuota public.cuota;
begin
  select * into v_pago from public.pago where id = new.pago_id for update;
  if v_pago.anulado_at is not null then
    raise exception 'El pago está anulado';
  end if;
  if (select coalesce(sum(monto_centimos), 0) from public.pago_aplicacion where pago_id = new.pago_id)
     + new.monto_centimos > v_pago.monto_centimos then
    raise exception 'La aplicación excede el monto del pago';
  end if;

  if new.item_plan_id is not null then
    select * into v_item from public.item_plan where id = new.item_plan_id for update;
    if v_item.plan_id <> v_pago.plan_id then
      raise exception 'El ítem no pertenece al plan del pago';
    end if;
    if v_item.estado = 'cancelado' then
      raise exception 'No se puede cobrar un ítem cancelado';
    end if;
    if (select coalesce(sum(a.monto_centimos), 0) from public.pago_aplicacion a
        join public.pago p on p.id = a.pago_id
        where a.item_plan_id = new.item_plan_id and p.anulado_at is null)
       + new.monto_centimos > v_item.precio_centimos then
      raise exception 'El cobro excede el precio del ítem';
    end if;
  end if;

  if new.cuota_id is not null then
    select * into v_cuota from public.cuota where id = new.cuota_id for update;
    if v_cuota.plan_id <> v_pago.plan_id then
      raise exception 'La cuota no pertenece al plan del pago';
    end if;
    if (select coalesce(sum(a.monto_centimos), 0) from public.pago_aplicacion a
        join public.pago p on p.id = a.pago_id
        where a.cuota_id = new.cuota_id and p.anulado_at is null)
       + new.monto_centimos > v_cuota.monto_centimos then
      raise exception 'El pago excede el saldo de la cuota';
    end if;
  end if;

  return new;
end $$;
create trigger validar before insert on public.pago_aplicacion
  for each row execute function privado.validar_aplicacion();

-- El precio de un ítem no puede bajar de lo ya cobrado.
create function privado.validar_precio_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.precio_centimos < (select coalesce(sum(a.monto_centimos), 0) from public.pago_aplicacion a
                            join public.pago p on p.id = a.pago_id
                            where a.item_plan_id = new.id and p.anulado_at is null) then
    raise exception 'El precio no puede ser menor a lo ya cobrado';
  end if;
  return new;
end $$;
create trigger validar_precio before update of precio_centimos on public.item_plan
  for each row execute function privado.validar_precio_item();

-- Saldos calculados (pagos anulados no cuentan)
create view public.v_item_cobro with (security_invoker = true) as
select i.id as item_plan_id, i.clinica_id, i.plan_id, i.estado, i.precio_centimos,
       coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0)::integer as cobrado_centimos,
       (i.precio_centimos - coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0))::integer as saldo_centimos,
       case
         when coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0) = 0 then 'pendiente'
         when coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0) < i.precio_centimos then 'parcial'
         else 'cobrado'
       end as estado_cobro
from public.item_plan i
left join public.pago_aplicacion a on a.item_plan_id = i.id
left join public.pago p on p.id = a.pago_id
group by i.id;

create view public.v_cuota_saldo with (security_invoker = true) as
select c.id as cuota_id, c.clinica_id, c.plan_id, c.numero, c.vence_el, c.monto_centimos,
       coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0)::integer as pagado_centimos,
       (c.monto_centimos - coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0))::integer as saldo_centimos,
       (c.vence_el < (now() at time zone 'America/Lima')::date
        and c.monto_centimos > coalesce(sum(a.monto_centimos) filter (where p.anulado_at is null), 0)) as vencida
from public.cuota c
left join public.pago_aplicacion a on a.cuota_id = c.id
left join public.pago p on p.id = a.pago_id
group by c.id;

-- RLS activado desde el inicio: sin políticas, nadie lee ni escribe.
alter table public.cuota enable row level security;
alter table public.pago enable row level security;
alter table public.pago_aplicacion enable row level security;
