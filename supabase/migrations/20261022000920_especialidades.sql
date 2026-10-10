-- Etapa 9 (v2), rebanada 2: registros por especialidad.
--
-- Aditiva. Cada registro se asocia a la evolución de la sesión (nota_id) y al ítem del
-- plan trabajado en ella (CLAUDE.md: «se asocian al ítem del plan y a la evolución»):
-- - endodoncia_conducto: por conducto, longitud de trabajo, referencia, lima maestra,
--   irrigación y técnica de obturación (las sesiones son las evoluciones que lo registran).
-- - ortodoncia_caso (diagnóstico y aparatología) y ortodoncia_control (arcos, ligaduras,
--   activaciones y observaciones; las fotos van en Imágenes con su sesión).
-- - implante (marca, diámetro, longitud, lote, torque) e implante_fase (fase y fecha; la
--   fecha de carga es la de la fase «carga»).
-- - cirugia_registro (técnica, sutura y días para el retiro de puntos: al firmar la
--   evolución se programa el control de retiro de puntos).
-- - odontopediatria_registro (apoderado presente y conducta; escala de Frankl opcional).
-- - Periodoncia usa el periodontograma (0919) y su mantenimiento.
--
-- Regla 2: se escriben mientras la evolución está en borrador, por su autor; firmada, no
-- se editan (se corrige con una adenda de la evolución). Regla 1: no se borran; en
-- borrador se anulan con motivo. Lo ve el personal clínico; lo escribe el cirujano dentista.

-- ---------------------------------------------------------------------------
-- Reglas comunes
-- ---------------------------------------------------------------------------
-- TG_ARGV[0]: especialidad esperada del procedimiento del ítem (o '' si no aplica).
create function privado.validar_registro_sesion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nota public.nota_evolucion;
  v_item uuid := (to_jsonb(new) ->> 'item_plan_id')::uuid;
  v_esp text := tg_argv[0];
  v_proc_esp text;
begin
  -- Desde la app, solo en la propia clínica (antes de mirar la evolución: no se revela
  -- si existe en otra).
  if current_setting('role', true) = 'authenticated' and new.clinica_id is distinct from privado.clinica_actual() then
    raise exception 'No autorizado';
  end if;
  select * into v_nota from public.nota_evolucion where id = new.nota_id and clinica_id = new.clinica_id;
  if v_nota.id is null then
    raise exception 'La evolución no existe en esta clínica';
  end if;
  new.paciente_id := v_nota.paciente_id;
  if current_setting('role', true) = 'authenticated' then
    new.registrado_por := auth.uid();
    new.registrado_at := now();
    new.anulado_at := null;
    new.anulado_por := null;
    new.motivo_anulacion := null;
    if v_nota.firmada_at is not null or v_nota.anulado_at is not null then
      raise exception 'Los registros de especialidad se escriben en una evolución en borrador';
    end if;
    if v_nota.odontologo_id is distinct from auth.uid() then
      raise exception 'Solo el autor de la evolución escribe sus registros';
    end if;
  end if;
  if v_item is not null then
    -- El ítem es del paciente y se trabajó en esta sesión.
    if not exists (select 1 from public.evolucion_item e where e.nota_id = new.nota_id and e.item_id = v_item and e.trabajado) then
      raise exception 'El ítem debe estar entre los trabajados en esta evolución';
    end if;
    select pr.especialidad::text into v_proc_esp
      from public.item_plan i join public.procedimiento pr on pr.id = i.procedimiento_id where i.id = v_item;
    if v_esp <> '' and v_proc_esp is not null and v_proc_esp <> v_esp then
      raise exception 'El ítem no es un procedimiento de %', v_esp;
    end if;
  end if;
  return new;
end $$;

-- Solo se anulan (en borrador, por el autor de la evolución, con motivo y sin tocar el
-- contenido). Firmada la evolución, quedan como están (regla 2).
create function privado.proteger_registro_sesion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nota public.nota_evolucion;
begin
  if privado.en_fusion() and (to_jsonb(new) - 'paciente_id') = (to_jsonb(old) - 'paciente_id') then
    return new;
  end if;
  if old.anulado_at is not null then
    raise exception 'El registro está anulado y no se modifica';
  end if;
  -- Anulación en cascada (se anuló la evolución o el implante): solo los datos de anulación.
  if privado.en_proceso() and new.anulado_at is not null
     and (to_jsonb(new) - array['anulado_at', 'anulado_por', 'motivo_anulacion'])
         = (to_jsonb(old) - array['anulado_at', 'anulado_por', 'motivo_anulacion']) then
    return new;
  end if;
  select * into v_nota from public.nota_evolucion where id = old.nota_id;
  if v_nota.firmada_at is not null then
    raise exception 'La evolución está firmada: corrige con una adenda';
  end if;
  if new.anulado_at is null
     or (to_jsonb(new) - array['anulado_at', 'anulado_por', 'motivo_anulacion'])
        is distinct from (to_jsonb(old) - array['anulado_at', 'anulado_por', 'motivo_anulacion']) then
    raise exception 'Un registro de especialidad no se edita: se anula con motivo y se registra de nuevo';
  end if;
  if current_setting('role', true) = 'authenticated'
     and (new.anulado_por is distinct from auth.uid() or v_nota.odontologo_id is distinct from auth.uid()) then
    raise exception 'Solo el autor de la evolución anula sus registros, a su nombre';
  end if;
  new.anulado_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.endodoncia_conducto (
  id                  uuid primary key default gen_random_uuid(),
  clinica_id          uuid not null,
  paciente_id         uuid not null,
  nota_id             uuid not null,
  item_plan_id        uuid not null,
  conducto            text not null check (char_length(btrim(conducto)) between 1 and 30),
  longitud_trabajo_mm numeric(3,1) check (longitud_trabajo_mm between 5 and 40),
  referencia          text check (char_length(referencia) <= 60),
  lima_maestra        text check (char_length(lima_maestra) <= 40),
  irrigacion          text check (char_length(irrigacion) <= 200),
  tecnica_obturacion  text check (char_length(tecnica_obturacion) <= 120),
  observaciones       text check (char_length(observaciones) <= 500),
  registrado_por      uuid not null default auth.uid(),
  registrado_at       timestamptz not null default now(),
  anulado_at          timestamptz,
  anulado_por         uuid,
  motivo_anulacion    text check (char_length(btrim(motivo_anulacion)) between 5 and 300),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint endodoncia_anulacion check ((anulado_at is null) = (motivo_anulacion is null) and (anulado_at is null) = (anulado_por is null)),
  constraint endodoncia_con_datos check (longitud_trabajo_mm is not null or lima_maestra is not null
    or irrigacion is not null or tecnica_obturacion is not null or observaciones is not null)
);

create table public.ortodoncia_caso (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  nota_id          uuid not null,
  item_plan_id     uuid not null,
  diagnostico      text not null check (char_length(btrim(diagnostico)) between 3 and 2000),
  aparatologia     text not null check (char_length(btrim(aparatologia)) between 3 and 1000),
  registrado_por   uuid not null default auth.uid(),
  registrado_at    timestamptz not null default now(),
  anulado_at       timestamptz,
  anulado_por      uuid,
  motivo_anulacion text check (char_length(btrim(motivo_anulacion)) between 5 and 300),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint ortodoncia_caso_anulacion check ((anulado_at is null) = (motivo_anulacion is null) and (anulado_at is null) = (anulado_por is null))
);
create unique index ortodoncia_caso_item on public.ortodoncia_caso (item_plan_id) where anulado_at is null;

create table public.ortodoncia_control (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  nota_id          uuid not null,
  item_plan_id     uuid not null,
  arco_superior    text check (char_length(arco_superior) <= 100),
  arco_inferior    text check (char_length(arco_inferior) <= 100),
  ligaduras        text check (char_length(ligaduras) <= 100),
  activaciones     text check (char_length(activaciones) <= 300),
  observaciones    text check (char_length(observaciones) <= 1000),
  registrado_por   uuid not null default auth.uid(),
  registrado_at    timestamptz not null default now(),
  anulado_at       timestamptz,
  anulado_por      uuid,
  motivo_anulacion text check (char_length(btrim(motivo_anulacion)) between 5 and 300),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint ortodoncia_control_anulacion check ((anulado_at is null) = (motivo_anulacion is null) and (anulado_at is null) = (anulado_por is null)),
  constraint ortodoncia_control_con_datos check (coalesce(arco_superior, arco_inferior, ligaduras, activaciones, observaciones) is not null)
);

create table public.implante (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  nota_id          uuid not null,   -- sesión de colocación
  item_plan_id     uuid not null,
  pieza            smallint not null check (pieza / 10 between 1 and 4 and pieza % 10 between 1 and 8),
  marca            text not null check (char_length(btrim(marca)) between 2 and 80),
  diametro_mm      numeric(3,1) not null check (diametro_mm between 2 and 8),
  longitud_mm      numeric(3,1) not null check (longitud_mm between 4 and 25),
  lote             text check (char_length(lote) <= 60),
  torque_ncm       smallint check (torque_ncm between 0 and 100),
  observaciones    text check (char_length(observaciones) <= 500),
  registrado_por   uuid not null default auth.uid(),
  registrado_at    timestamptz not null default now(),
  anulado_at       timestamptz,
  anulado_por      uuid,
  motivo_anulacion text check (char_length(btrim(motivo_anulacion)) between 5 and 300),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint implante_anulacion check ((anulado_at is null) = (motivo_anulacion is null) and (anulado_at is null) = (anulado_por is null))
);
create unique index implante_item on public.implante (item_plan_id) where anulado_at is null;

-- Fases del implante en sesiones posteriores (la de colocación se crea con el implante).
create table public.implante_fase (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  nota_id          uuid not null,
  implante_id      uuid not null,
  fase             text not null check (fase in ('colocacion', 'oseointegracion', 'segunda_fase', 'protesica', 'carga')),
  fecha            date not null,
  observaciones    text check (char_length(observaciones) <= 500),
  registrado_por   uuid not null default auth.uid(),
  registrado_at    timestamptz not null default now(),
  anulado_at       timestamptz,
  anulado_por      uuid,
  motivo_anulacion text check (char_length(btrim(motivo_anulacion)) between 5 and 300),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, implante_id) references public.implante (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint implante_fase_anulacion check ((anulado_at is null) = (motivo_anulacion is null) and (anulado_at is null) = (anulado_por is null))
);

create table public.cirugia_registro (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null,
  paciente_id        uuid not null,
  nota_id            uuid not null,
  item_plan_id       uuid not null,
  tecnica            text not null check (char_length(btrim(tecnica)) between 3 and 500),
  sutura             text check (char_length(sutura) <= 200),
  retiro_puntos_dias smallint check (retiro_puntos_dias between 3 and 30),
  observaciones      text check (char_length(observaciones) <= 500),
  registrado_por     uuid not null default auth.uid(),
  registrado_at      timestamptz not null default now(),
  anulado_at         timestamptz,
  anulado_por        uuid,
  motivo_anulacion   text check (char_length(btrim(motivo_anulacion)) between 5 and 300),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint cirugia_anulacion check ((anulado_at is null) = (motivo_anulacion is null) and (anulado_at is null) = (anulado_por is null)),
  constraint cirugia_puntos_con_sutura check (retiro_puntos_dias is null or sutura is not null)
);

create table public.odontopediatria_registro (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null,
  paciente_id        uuid not null,
  nota_id            uuid not null,
  item_plan_id       uuid,
  apoderado_presente boolean not null,
  acompanante        text check (char_length(acompanante) <= 120),
  -- Escala de Frankl: 1 definitivamente negativa, 2 negativa, 3 positiva, 4 definitivamente positiva.
  conducta_frankl    smallint check (conducta_frankl between 1 and 4),
  conducta           text check (char_length(conducta) <= 500),
  registrado_por     uuid not null default auth.uid(),
  registrado_at      timestamptz not null default now(),
  anulado_at         timestamptz,
  anulado_por        uuid,
  motivo_anulacion   text check (char_length(btrim(motivo_anulacion)) between 5 and 300),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint odontopediatria_anulacion check ((anulado_at is null) = (motivo_anulacion is null) and (anulado_at is null) = (anulado_por is null)),
  constraint odontopediatria_con_conducta check (conducta_frankl is not null or conducta is not null)
);
create unique index odontopediatria_una_por_sesion on public.odontopediatria_registro (nota_id) where anulado_at is null;

-- Triggers, RLS y permisos de las siete tablas
do $$
declare
  t record;
begin
  for t in select * from (values
      ('endodoncia_conducto', 'endodoncia'), ('ortodoncia_caso', 'ortodoncia'), ('ortodoncia_control', 'ortodoncia'),
      ('implante', 'implantes'), ('implante_fase', ''), ('cirugia_registro', 'cirugia'), ('odontopediatria_registro', '')
    ) as x(tabla, especialidad) loop
    execute format('alter table public.%I enable row level security', t.tabla);
    execute format('create trigger validar before insert on public.%I for each row execute function privado.validar_registro_sesion(%L)',
                   t.tabla, t.especialidad);
    -- Después de «validar» (que fija paciente_id desde la evolución): orden alfabético.
    execute format('create trigger validar_vigente before insert on public.%I for each row execute function privado.validar_paciente_vigente()', t.tabla);
    execute format('create trigger proteger before update on public.%I for each row execute function privado.proteger_registro_sesion()', t.tabla);
    execute format('create trigger auditar after insert or update on public.%I for each row execute function privado.auditar_simple()', t.tabla);
    execute format('create index on public.%I (paciente_id)', t.tabla);
    execute format('create index on public.%I (nota_id)', t.tabla);
    execute format($p$create policy %I on public.%I for select to authenticated
                     using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()))$p$,
                   t.tabla || '_select', t.tabla);
    execute format($p$create policy %I on public.%I for insert to authenticated
                     with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))$p$,
                   t.tabla || '_insert', t.tabla);
    execute format($p$create policy %I on public.%I for update to authenticated
                     using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
                     with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()))$p$,
                   t.tabla || '_anular', t.tabla);
    execute format('revoke all on public.%I from anon, authenticated', t.tabla);
    execute format('grant select on public.%I to authenticated', t.tabla);
    execute format('grant update (anulado_at, anulado_por, motivo_anulacion) on public.%I to authenticated', t.tabla);
  end loop;
end $$;

grant insert (clinica_id, nota_id, item_plan_id, conducto, longitud_trabajo_mm, referencia, lima_maestra, irrigacion,
              tecnica_obturacion, observaciones) on public.endodoncia_conducto to authenticated;
grant insert (clinica_id, nota_id, item_plan_id, diagnostico, aparatologia) on public.ortodoncia_caso to authenticated;
grant insert (clinica_id, nota_id, item_plan_id, arco_superior, arco_inferior, ligaduras, activaciones, observaciones)
  on public.ortodoncia_control to authenticated;
grant insert (clinica_id, nota_id, item_plan_id, pieza, marca, diametro_mm, longitud_mm, lote, torque_ncm, observaciones)
  on public.implante to authenticated;
grant insert (clinica_id, nota_id, implante_id, fase, fecha, observaciones) on public.implante_fase to authenticated;
grant insert (clinica_id, nota_id, item_plan_id, tecnica, sutura, retiro_puntos_dias, observaciones)
  on public.cirugia_registro to authenticated;
grant insert (clinica_id, nota_id, item_plan_id, apoderado_presente, acompanante, conducta_frankl, conducta)
  on public.odontopediatria_registro to authenticated;

-- ---------------------------------------------------------------------------
-- Implantes: la pieza es la del ítem; la colocación es la primera fase
-- ---------------------------------------------------------------------------
create function privado.preparar_implante() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pieza smallint;
begin
  select pieza into v_pieza from public.item_plan where id = new.item_plan_id;
  if v_pieza is not null and v_pieza <> new.pieza then
    raise exception 'La pieza del implante debe ser la del ítem (%)', v_pieza;
  end if;
  return new;
end $$;
create trigger preparar before insert on public.implante for each row execute function privado.preparar_implante();

create function privado.fase_inicial_implante() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.implante_fase (clinica_id, paciente_id, nota_id, implante_id, fase, fecha, registrado_por, registrado_at)
  values (new.clinica_id, new.paciente_id, new.nota_id, new.id, 'colocacion',
          (now() at time zone 'America/Lima')::date, new.registrado_por, new.registrado_at);
  return new;
end $$;
create trigger fase_inicial after insert on public.implante for each row execute function privado.fase_inicial_implante();

-- Una fase posterior: del mismo paciente, implante vigente, fecha no futura.
create function privado.validar_implante_fase() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.implante i where i.id = new.implante_id and i.paciente_id = new.paciente_id
                   and i.anulado_at is null) then
    raise exception 'El implante no es de este paciente o está anulado';
  end if;
  if new.fecha > (now() at time zone 'America/Lima')::date then
    raise exception 'La fecha de la fase no puede ser futura';
  end if;
  if new.fase = 'colocacion' and exists (select 1 from public.implante_fase f where f.implante_id = new.implante_id
                                           and f.fase = 'colocacion' and f.anulado_at is null) then
    raise exception 'La colocación ya está registrada';
  end if;
  return new;
end $$;
-- Después de validar_registro_sesion (que fija paciente_id): los triggers se ejecutan por nombre.
create trigger validar_fase before insert on public.implante_fase for each row execute function privado.validar_implante_fase();

-- ---------------------------------------------------------------------------
-- Anulaciones en cascada: al anular la evolución, sus registros; al anular un implante,
-- sus fases. Así no quedan registros vigentes ocultos que bloqueen el ítem.
-- ---------------------------------------------------------------------------
create function privado.anular_registros_de(tabla text, columna text, id uuid, autor uuid, motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_previo text := coalesce(current_setting('dental.proceso', true), '');
begin
  perform set_config('dental.proceso', 'on', true);
  execute format('update public.%I set anulado_at = now(), anulado_por = $1, motivo_anulacion = $2
                   where %I = $3 and anulado_at is null', tabla, columna)
    using autor, left(motivo, 300), id;
  perform set_config('dental.proceso', v_previo, true);
end $$;

create function privado.al_anular_evolucion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t text;
begin
  if new.anulado_at is null or old.anulado_at is not null then
    return new;
  end if;
  foreach t in array array['endodoncia_conducto', 'ortodoncia_caso', 'ortodoncia_control', 'implante', 'implante_fase',
                           'cirugia_registro', 'odontopediatria_registro'] loop
    perform privado.anular_registros_de(t, 'nota_id', new.id, new.anulado_por, 'Evolución anulada: ' || new.motivo_anulacion);
  end loop;
  return new;
end $$;
create trigger al_anular after update of anulado_at on public.nota_evolucion
  for each row execute function privado.al_anular_evolucion();

create function privado.al_anular_implante() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.anulado_at is not null and old.anulado_at is null then
    perform privado.anular_registros_de('implante_fase', 'implante_id', new.id, new.anulado_por,
                                        'Implante anulado: ' || new.motivo_anulacion);
  end if;
  return new;
end $$;
create trigger al_anular after update of anulado_at on public.implante
  for each row execute function privado.al_anular_implante();

-- ---------------------------------------------------------------------------
-- Cirugía: al firmar la evolución, el control de retiro de puntos (regla 5)
-- ---------------------------------------------------------------------------
create function privado.al_firmar_evolucion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.firmada_at is null or old.firmada_at is not null then
    return new;
  end if;
  -- Antes de que los ítems pasen a realizado: este control (con los días que indicó el
  -- cirujano) prevalece sobre el del catálogo para el mismo ítem.
  insert into public.seguimiento (clinica_id, paciente_id, plan_id, item_plan_id, tipo, fecha_programada, nota)
  select c.clinica_id, c.paciente_id, i.plan_id, c.item_plan_id, 'retiro_puntos',
         (new.fecha at time zone 'America/Lima')::date + c.retiro_puntos_dias,
         left('Retiro de puntos: ' || i.procedimiento || coalesce(' (pieza ' || i.pieza || ')', ''), 200)
    from public.cirugia_registro c join public.item_plan i on i.id = c.item_plan_id
   where c.nota_id = new.id and c.anulado_at is null and c.retiro_puntos_dias is not null
  on conflict (item_plan_id) where item_plan_id is not null do nothing;
  return new;
end $$;
create trigger al_firmar after update of firmada_at on public.nota_evolucion
  for each row execute function privado.al_firmar_evolucion();

-- ---------------------------------------------------------------------------
-- Fusión de pacientes y auditoría
-- ---------------------------------------------------------------------------
create or replace function privado.fusion_mover_extra(duplicado uuid, conservar uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n_archivos int;
  n_consentimientos int;
  n_recetas int;
  n_constancias int;
  n_interconsultas int;
  n_periodontogramas int;
  n_especialidad int := 0;
  n int;
  t text;
begin
  update public.archivo_clinico set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_archivos = row_count;
  perform privado.fusion_uso_imagen(duplicado, conservar);
  update public.consentimiento set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_consentimientos = row_count;
  update public.receta set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_recetas = row_count;
  update public.constancia set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_constancias = row_count;
  update public.interconsulta set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_interconsultas = row_count;
  update public.periodontograma set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_periodontogramas = row_count;
  foreach t in array array['endodoncia_conducto', 'ortodoncia_caso', 'ortodoncia_control', 'implante', 'implante_fase',
                           'cirugia_registro', 'odontopediatria_registro'] loop
    execute format('update public.%I set paciente_id = $1 where paciente_id = $2', t) using conservar, duplicado;
    get diagnostics n = row_count;
    n_especialidad := n_especialidad + n;
  end loop;
  return jsonb_build_object('archivos', n_archivos, 'consentimientos', n_consentimientos, 'recetas', n_recetas,
                            'constancias', n_constancias, 'interconsultas', n_interconsultas,
                            'periodontogramas', n_periodontogramas, 'registros_especialidad', n_especialidad);
end $$;

drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica', 'examen_clinico', 'diagnostico',
                            'diagnostico_adenda', 'evolucion_adenda', 'evolucion_item', 'archivo_clinico',
                            'consentimiento', 'receta', 'constancia', 'interconsulta', 'periodontograma',
                            'endodoncia_conducto', 'ortodoncia_caso', 'ortodoncia_control', 'implante',
                            'implante_fase', 'cirugia_registro', 'odontopediatria_registro')
              or (select privado.es_dentista())));
