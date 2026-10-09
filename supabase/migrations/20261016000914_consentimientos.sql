-- Etapa 7 (v2), rebanada 2: consentimiento informado y consentimiento de uso de imagen.
--
-- Decisión de Pedro (2026-10-09): el paciente o su representante firma A MANO. La NTS
-- 139 (4.3.3 c y formato 16) no admite la firma electrónica del paciente para el
-- consentimiento informado: exige firma manuscrita y huella en el formato, o firma
-- digital. El sistema genera el formato con lo que pide la norma, se imprime, se firma
-- y se sube el escaneo; recién entonces el consentimiento cuenta como firmado.
-- También se registra la negativa (escaneada) y la revocación (NTS 139, formato 16).
--
-- Aditiva:
-- - plantilla_consentimiento: textos por procedimiento, editables por el administrador.
--   Las de ejemplo quedan marcadas: la clínica debe revisarlas.
-- - procedimiento.consentimiento_plantilla_id: «cuál» consentimiento requiere.
-- - consentimiento: copia el texto de la plantilla al generarse (lo que el paciente
--   firmó no cambia si luego se edita la plantilla). Sin UPDATE desde la API: los
--   cambios de estado pasan por funciones que validan y dejan auditoría.
-- Regla 3 completa: realizado = evolución firmada + consentimiento firmado si el
-- procedimiento lo requiere.

-- ---------------------------------------------------------------------------
-- Plantillas
-- ---------------------------------------------------------------------------
create table public.plantilla_consentimiento (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null references public.clinica (id),
  tipo              text not null check (tipo in ('procedimiento', 'uso_imagen')),
  nombre            text not null check (char_length(btrim(nombre)) between 3 and 120),
  -- Lo que pide la NTS 139 (formato 16), en términos sencillos.
  descripcion       text not null check (char_length(btrim(descripcion)) between 10 and 4000),
  riesgos           text not null check (char_length(btrim(riesgos)) between 10 and 4000),
  efectos_adversos  text check (char_length(efectos_adversos) <= 4000),
  pronostico        text check (char_length(pronostico) <= 2000),
  -- Plantilla de ejemplo del sistema: se imprime con un aviso hasta que la clínica la revise.
  es_ejemplo        boolean not null default false,
  activa            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (clinica_id, id)
);
create unique index plantilla_consentimiento_nombre on public.plantilla_consentimiento (clinica_id, lower(btrim(nombre)));
alter table public.plantilla_consentimiento enable row level security;
create trigger updated_at before update on public.plantilla_consentimiento
  for each row execute function privado.tocar_updated_at();
create trigger auditar after insert or update on public.plantilla_consentimiento
  for each row execute function privado.auditar_simple();

create policy plantilla_consentimiento_select on public.plantilla_consentimiento for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and ((select privado.ve_clinico()) or (select privado.rol_actual()) = 'admin'));
create policy plantilla_consentimiento_insert on public.plantilla_consentimiento for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');
create policy plantilla_consentimiento_update on public.plantilla_consentimiento for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (clinica_id = (select privado.clinica_actual()));
revoke all on public.plantilla_consentimiento from anon, authenticated;
grant select on public.plantilla_consentimiento to authenticated;
grant insert (id, clinica_id, tipo, nombre, descripcion, riesgos, efectos_adversos, pronostico)
  on public.plantilla_consentimiento to authenticated;
grant update (nombre, descripcion, riesgos, efectos_adversos, pronostico, es_ejemplo, activa)
  on public.plantilla_consentimiento to authenticated;

-- El catálogo dice cuál consentimiento requiere cada procedimiento.
alter table public.procedimiento add column consentimiento_plantilla_id uuid;
alter table public.procedimiento
  add constraint procedimiento_plantilla_fk
  foreign key (clinica_id, consentimiento_plantilla_id) references public.plantilla_consentimiento (clinica_id, id);
grant update (consentimiento_plantilla_id) on public.procedimiento to authenticated;

create function privado.validar_plantilla_procedimiento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.consentimiento_plantilla_id is not null and not exists (
       select 1 from public.plantilla_consentimiento t
        where t.id = new.consentimiento_plantilla_id and t.tipo = 'procedimiento') then
    raise exception 'Elige una plantilla de consentimiento de procedimiento';
  end if;
  return new;
end $$;
create trigger validar_plantilla before insert or update of consentimiento_plantilla_id on public.procedimiento
  for each row execute function privado.validar_plantilla_procedimiento();

-- ---------------------------------------------------------------------------
-- Consentimientos
-- ---------------------------------------------------------------------------
create table public.consentimiento (
  id                        uuid primary key default gen_random_uuid(),
  clinica_id                uuid not null,
  paciente_id               uuid not null,
  tipo                      text not null check (tipo in ('procedimiento', 'uso_imagen')),
  plantilla_id              uuid not null,
  item_plan_id              uuid,
  -- Copia del texto de la plantilla al generarse
  titulo                    text not null,
  descripcion               text not null,
  riesgos                   text not null,
  efectos_adversos          text,
  pronostico                text,
  es_ejemplo                boolean not null default false,
  -- Uso de imagen: fines autorizados
  fines                     text[] check (fines <@ array['academico', 'difusion']::text[]),
  -- Profesional responsable (cirujano dentista) y representante si es menor de edad
  profesional_id            uuid not null,
  representante_nombre      text,
  representante_documento   text,
  representante_parentesco  text,
  creado_at                 timestamptz not null default now(),
  -- pendiente (impreso, por firmar) → firmado | negado; firmado → revocado
  estado                    text not null default 'pendiente'
                              check (estado in ('pendiente', 'firmado', 'negado', 'revocado')),
  decidido_el               date,
  archivo_id                uuid,
  registrado_por            uuid,
  registrado_at             timestamptz,
  revocado_at               timestamptz,
  revocado_por              uuid,
  motivo_revocacion         text check (char_length(motivo_revocacion) <= 300),
  anulado_at                timestamptz,
  anulado_por               uuid,
  motivo_anulacion          text check (char_length(motivo_anulacion) <= 200),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, plantilla_id) references public.plantilla_consentimiento (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, profesional_id) references public.usuario (clinica_id, id),
  foreign key (clinica_id, archivo_id) references public.archivo_clinico (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, revocado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint consentimiento_tipo check (
    (tipo = 'procedimiento' and item_plan_id is not null and fines is null)
    or (tipo = 'uso_imagen' and item_plan_id is null and cardinality(fines) > 0)),
  constraint consentimiento_decision check (
    (estado = 'pendiente') = (archivo_id is null and decidido_el is null)),
  constraint consentimiento_revocacion check ((estado = 'revocado') = (revocado_at is not null)),
  constraint consentimiento_anulacion check ((anulado_at is null) = (motivo_anulacion is null)
                                             and (anulado_at is null or estado = 'pendiente'))
);
alter table public.consentimiento enable row level security;
create index consentimiento_paciente_idx on public.consentimiento (paciente_id, creado_at desc);
-- Uno vigente (pendiente o firmado) por ítem, y uno de uso de imagen por paciente.
create unique index consentimiento_item_vigente on public.consentimiento (item_plan_id)
  where anulado_at is null and estado in ('pendiente', 'firmado');
create unique index consentimiento_imagen_vigente on public.consentimiento (paciente_id)
  where tipo = 'uso_imagen' and anulado_at is null and estado in ('pendiente', 'firmado');

-- Al generarse: el texto sale de la plantilla, el responsable es quien lo genera y el
-- representante, el apoderado registrado si el paciente es menor de edad.
create function privado.preparar_consentimiento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plantilla public.plantilla_consentimiento;
  v_paciente public.paciente;
  v_item public.item_plan;
begin
  select * into v_plantilla from public.plantilla_consentimiento
   where id = new.plantilla_id and clinica_id = new.clinica_id;
  if v_plantilla.id is null or not v_plantilla.activa or v_plantilla.tipo <> new.tipo then
    raise exception 'Elige una plantilla de consentimiento activa y del tipo correcto';
  end if;
  select * into v_paciente from public.paciente where id = new.paciente_id;
  new.titulo := v_plantilla.nombre;
  if new.tipo = 'procedimiento' then
    select i.* into v_item from public.item_plan i join public.plan_tratamiento p on p.id = i.plan_id
     where i.id = new.item_plan_id and p.paciente_id = new.paciente_id;
    if v_item.id is null then
      raise exception 'El ítem no corresponde a este paciente';
    end if;
    if v_item.estado not in ('propuesto', 'aceptado', 'programado') then
      raise exception 'El ítem ya está realizado o cancelado';
    end if;
    new.titulo := v_plantilla.nombre || ' — ' || v_item.procedimiento
                  || coalesce(' (pieza ' || v_item.pieza || ')', '');
  end if;
  new.descripcion := v_plantilla.descripcion;
  new.riesgos := v_plantilla.riesgos;
  new.efectos_adversos := v_plantilla.efectos_adversos;
  new.pronostico := v_plantilla.pronostico;
  new.es_ejemplo := v_plantilla.es_ejemplo;
  if v_paciente.fecha_nacimiento is not null
     and v_paciente.fecha_nacimiento > ((now() at time zone 'America/Lima')::date - interval '18 years') then
    if nullif(btrim(v_paciente.apoderado_nombre), '') is null then
      raise exception 'Paciente menor de edad: registra a su apoderado antes de generar el consentimiento';
    end if;
    new.representante_nombre := v_paciente.apoderado_nombre;
    new.representante_documento := v_paciente.apoderado_dni;
    new.representante_parentesco := v_paciente.apoderado_parentesco;
  else
    new.representante_nombre := null;
    new.representante_documento := null;
    new.representante_parentesco := null;
  end if;
  if auth.uid() is not null then
    new.profesional_id := auth.uid();
  end if;
  if not exists (select 1 from public.usuario u where u.id = new.profesional_id
                  and u.rol in ('admin', 'odontologo') and u.cop is not null) then
    raise exception 'El responsable del consentimiento es un cirujano dentista';
  end if;
  new.creado_at := now();
  new.estado := 'pendiente';
  new.decidido_el := null; new.archivo_id := null; new.registrado_por := null; new.registrado_at := null;
  new.revocado_at := null; new.revocado_por := null; new.motivo_revocacion := null;
  new.anulado_at := null; new.anulado_por := null; new.motivo_anulacion := null;
  return new;
end $$;
create trigger preparar before insert on public.consentimiento
  for each row execute function privado.preparar_consentimiento();
create trigger paciente_vigente before insert on public.consentimiento
  for each row execute function privado.validar_paciente_vigente();
create trigger auditar after insert or update on public.consentimiento
  for each row execute function privado.auditar();

-- Ven el personal clínico; genera el cirujano dentista. Sin UPDATE ni DELETE: las
-- funciones de abajo registran la firma, la negativa, la revocación o la anulación.
create policy consentimiento_select on public.consentimiento for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy consentimiento_insert on public.consentimiento for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
revoke all on public.consentimiento from anon, authenticated;
grant select on public.consentimiento to authenticated;
grant insert (id, clinica_id, paciente_id, tipo, plantilla_id, item_plan_id, fines, profesional_id)
  on public.consentimiento to authenticated;

-- ---------------------------------------------------------------------------
-- Firma (o negativa): se sube el formato firmado a mano y se registra
-- ---------------------------------------------------------------------------
create function public.registrar_consentimiento(id_consentimiento uuid, decision text, decidido date,
                                                ruta text, mime text, bytes integer, nombre text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.consentimiento;
  v_archivo uuid;
begin
  if not privado.ve_clinico() then
    raise exception 'Solo el personal clínico registra consentimientos';
  end if;
  select * into v from public.consentimiento
   where id = id_consentimiento and clinica_id = privado.clinica_actual() for update;
  if v.id is null then
    raise exception 'Consentimiento no encontrado';
  end if;
  if v.anulado_at is not null or v.estado <> 'pendiente' then
    raise exception 'Este consentimiento ya fue registrado o anulado';
  end if;
  if decision not in ('firmado', 'negado') then
    raise exception 'Indica si el paciente firmó o se negó';
  end if;
  if decidido is null or decidido > (now() at time zone 'America/Lima')::date
     or decidido < (v.creado_at at time zone 'America/Lima')::date then
    raise exception 'La fecha de firma debe estar entre la fecha del formato y hoy';
  end if;
  -- El escaneo del formato firmado: debe estar subido al bucket en la ruta del paciente.
  insert into public.archivo_clinico (clinica_id, paciente_id, tipo, ruta, nombre, mime, bytes, tomada_el, descripcion,
                                      subido_por)
  values (v.clinica_id, v.paciente_id, 'consentimiento', ruta, left(nombre, 200), mime, bytes, decidido,
          left(case decision when 'firmado' then 'Consentimiento firmado: ' else 'Negativa firmada: ' end || v.titulo, 500),
          auth.uid())
  returning id into v_archivo;
  update public.consentimiento set estado = decision, decidido_el = decidido, archivo_id = v_archivo,
         registrado_por = auth.uid(), registrado_at = now()
   where id = v.id;
  return v_archivo;
end $$;
revoke all on function public.registrar_consentimiento(uuid, text, date, text, text, integer, text) from public, anon;
grant execute on function public.registrar_consentimiento(uuid, text, date, text, text, integer, text) to authenticated;

-- El paciente retira su consentimiento (lo hecho queda; lo pendiente ya no se realiza).
create function public.revocar_consentimiento(id_consentimiento uuid, motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.consentimiento;
begin
  if not privado.es_dentista() then
    raise exception 'Solo el cirujano dentista registra la revocación';
  end if;
  if char_length(btrim(coalesce(motivo, ''))) < 3 then
    raise exception 'Indica el motivo de la revocación';
  end if;
  select * into v from public.consentimiento
   where id = id_consentimiento and clinica_id = privado.clinica_actual() for update;
  if v.id is null or v.estado <> 'firmado' then
    raise exception 'Solo se revoca un consentimiento firmado';
  end if;
  update public.consentimiento set estado = 'revocado', revocado_at = now(), revocado_por = auth.uid(),
         motivo_revocacion = left(btrim(motivo), 300)
   where id = v.id;
end $$;
revoke all on function public.revocar_consentimiento(uuid, text) from public, anon;
grant execute on function public.revocar_consentimiento(uuid, text) to authenticated;

-- Formato generado por error (aún sin firmar): se anula con motivo.
create function public.anular_consentimiento(id_consentimiento uuid, motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.consentimiento;
begin
  if not privado.es_dentista() then
    raise exception 'Solo el cirujano dentista anula un consentimiento';
  end if;
  if char_length(btrim(coalesce(motivo, ''))) < 3 then
    raise exception 'Indica por qué se anula';
  end if;
  select * into v from public.consentimiento
   where id = id_consentimiento and clinica_id = privado.clinica_actual() for update;
  if v.id is null or v.estado <> 'pendiente' or v.anulado_at is not null then
    raise exception 'Solo se anula un consentimiento pendiente de firma';
  end if;
  update public.consentimiento set anulado_at = now(), anulado_por = auth.uid(), motivo_anulacion = left(btrim(motivo), 200)
   where id = v.id;
end $$;
revoke all on function public.anular_consentimiento(uuid, text) from public, anon;
grant execute on function public.anular_consentimiento(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Regla 3 completa
-- ---------------------------------------------------------------------------
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
    -- Desde la app, solo al firmar la evolución de la sesión en que se terminó
    -- (no citando una evolución antigua o ajena). Las cargas del sistema (seed, sin el rol
    -- `authenticated` de la API) no pasan por aquí. `role` sigue siendo el de la sesión
    -- dentro de esta función SECURITY DEFINER.
    if current_setting('role', true) = 'authenticated' then
      if not exists (
        select 1 from public.evolucion_item e
         where e.nota_id = new.nota_evolucion_id and e.item_id = new.id and e.trabajado and e.terminado
      ) then
        raise exception 'Un ítem se marca realizado al firmar la evolución de la sesión en que se terminó';
      end if;
      -- Y con el consentimiento informado firmado (vigente) si el procedimiento lo requiere.
      if exists (select 1 from public.procedimiento pr where pr.id = new.procedimiento_id and pr.requiere_consentimiento)
         and not exists (select 1 from public.consentimiento c
                          where c.item_plan_id = new.id and c.estado = 'firmado' and c.anulado_at is null) then
        raise exception '«%» requiere el consentimiento informado firmado antes de realizarse', new.procedimiento;
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Fusión y auditoría
-- ---------------------------------------------------------------------------
create or replace function privado.fusion_mover_extra(duplicado uuid, conservar uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n_archivos int;
  n_consentimientos int;
begin
  update public.archivo_clinico set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_archivos = row_count;
  -- Uso de imagen: si ambos tenían uno vigente, el del duplicado queda anulado (pendiente)
  -- o se conserva el historial (firmado) pero solo uno sigue vigente.
  update public.consentimiento set anulado_at = now(), anulado_por = auth.uid(),
         motivo_anulacion = 'Fusión de pacientes: el paciente que se conserva ya tenía uno'
   where paciente_id = duplicado and tipo = 'uso_imagen' and estado = 'pendiente' and anulado_at is null
     and exists (select 1 from public.consentimiento c where c.paciente_id = conservar and c.tipo = 'uso_imagen'
                  and c.anulado_at is null and c.estado in ('pendiente', 'firmado'));
  update public.consentimiento set estado = 'revocado', revocado_at = now(), revocado_por = auth.uid(),
         motivo_revocacion = 'Fusión de pacientes: se conserva el consentimiento del otro registro'
   where paciente_id = duplicado and tipo = 'uso_imagen' and estado = 'firmado' and anulado_at is null
     and exists (select 1 from public.consentimiento c where c.paciente_id = conservar and c.tipo = 'uso_imagen'
                  and c.anulado_at is null and c.estado in ('pendiente', 'firmado'));
  update public.consentimiento set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_consentimientos = row_count;
  return jsonb_build_object('archivos', n_archivos, 'consentimientos', n_consentimientos);
end $$;

drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica', 'examen_clinico', 'diagnostico',
                            'diagnostico_adenda', 'evolucion_adenda', 'evolucion_item', 'archivo_clinico',
                            'consentimiento')
              or (select privado.es_dentista())));
