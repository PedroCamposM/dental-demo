-- Etapa 10 (v2): laboratorio.
--
-- Aditiva:
-- - laboratorio: los laboratorios con los que trabaja la clínica (los administra el admin).
-- - orden_laboratorio: orden de trabajo vinculada al ítem del plan, con pieza, tipo de
--   trabajo, laboratorio, color, indicaciones, fechas de envío, entrega prevista y
--   recepción, estado y costo (céntimos, regla 7).
--   Estados: por enviar → en laboratorio → recibida; o cancelada (con motivo). Los cambios
--   de estado se hacen con funciones (enviar, recibir, cancelar); la orden no se edita ni
--   se borra (regla 1).
-- - Atrasada: en laboratorio con la entrega prevista ya pasada. Se calcula con las fechas
--   (no se guarda), así no queda desactualizada; la ven el Tablero clínico y Laboratorio.
-- La prescribe el cirujano dentista; el envío y la recepción los registra también la
-- asistente. Recepción no la ve (datos clínicos).

create table public.laboratorio (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinica (id),
  nombre      text not null check (char_length(btrim(nombre)) between 2 and 120),
  telefono    text check (telefono ~ '^\+?[0-9 ]{6,20}$'),
  contacto    text check (char_length(contacto) <= 120),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (clinica_id, id)
);
create unique index laboratorio_nombre on public.laboratorio (clinica_id, lower(btrim(nombre)));
alter table public.laboratorio enable row level security;
create trigger auditar after insert or update on public.laboratorio for each row execute function privado.auditar_simple();

create type public.estado_orden_lab as enum ('por_enviar', 'en_laboratorio', 'recibida', 'cancelada');

create table public.orden_laboratorio (
  id                     uuid primary key default gen_random_uuid(),
  clinica_id             uuid not null,
  paciente_id            uuid not null,
  item_plan_id           uuid not null,
  laboratorio_id         uuid not null,
  pieza                  smallint check (pieza is null or privado.es_pieza_fdi(pieza)),
  tipo_trabajo           text not null check (char_length(btrim(tipo_trabajo)) between 2 and 200),
  color                  text check (char_length(color) <= 40),
  indicaciones           text check (char_length(indicaciones) <= 1000),
  estado                 public.estado_orden_lab not null default 'por_enviar',
  fecha_envio            date,
  fecha_entrega_prevista date,
  fecha_recepcion        date,
  costo_centimos         integer check (costo_centimos between 0 and 10000000),
  motivo_cancelacion     text check (char_length(btrim(motivo_cancelacion)) between 5 and 300),
  registrado_por         uuid not null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, item_plan_id) references public.item_plan (clinica_id, id),
  foreign key (clinica_id, laboratorio_id) references public.laboratorio (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  constraint orden_enviada_con_fechas check (estado in ('por_enviar', 'cancelada')
    or (fecha_envio is not null and fecha_entrega_prevista is not null)),
  constraint orden_recibida_con_fecha check (estado <> 'recibida' or fecha_recepcion is not null),
  constraint orden_fechas_coherentes check (fecha_entrega_prevista >= fecha_envio and fecha_recepcion >= fecha_envio),
  constraint orden_cancelada_con_motivo check ((estado = 'cancelada') = (motivo_cancelacion is not null))
);
alter table public.orden_laboratorio enable row level security;
create index orden_laboratorio_paciente on public.orden_laboratorio (paciente_id, created_at desc);
create index orden_laboratorio_pendiente on public.orden_laboratorio (clinica_id, estado, fecha_entrega_prevista);
create trigger auditar after insert or update on public.orden_laboratorio for each row execute function privado.auditar_simple();

-- Al crearla: el paciente es el del ítem; el ítem está aceptado, programado o realizado
-- (una repetición); el laboratorio está activo; la pieza, por defecto, la del ítem.
create function privado.preparar_orden_laboratorio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_item record;
begin
  if current_setting('role', true) = 'authenticated' and new.clinica_id is distinct from privado.clinica_actual() then
    raise exception 'No autorizado';
  end if;
  select i.estado, i.pieza, p.paciente_id into v_item
    from public.item_plan i join public.plan_tratamiento p on p.id = i.plan_id
   where i.id = new.item_plan_id and i.clinica_id = new.clinica_id;
  if v_item.paciente_id is null then
    raise exception 'El ítem del plan no existe';
  end if;
  if v_item.estado::text not in ('aceptado', 'programado', 'realizado') then
    raise exception 'La orden de laboratorio se hace para un ítem aceptado';
  end if;
  if not exists (select 1 from public.laboratorio l where l.id = new.laboratorio_id and l.clinica_id = new.clinica_id and l.activo) then
    raise exception 'Elige un laboratorio activo';
  end if;
  new.paciente_id := v_item.paciente_id;
  new.pieza := coalesce(new.pieza, v_item.pieza);
  if current_setting('role', true) = 'authenticated' then
    new.registrado_por := auth.uid();
    new.estado := 'por_enviar';
    new.fecha_envio := null;
    new.fecha_entrega_prevista := null;
    new.fecha_recepcion := null;
    new.motivo_cancelacion := null;
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger preparar before insert on public.orden_laboratorio
  for each row execute function privado.preparar_orden_laboratorio();
-- Después de «preparar» (que fija paciente_id): orden alfabético.
create trigger validar_vigente before insert on public.orden_laboratorio
  for each row execute function privado.validar_paciente_vigente();

-- Una orden no se edita: sus cambios pasan por las funciones de abajo (o la fusión).
create function privado.proteger_orden_laboratorio() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.en_fusion() and (to_jsonb(new) - 'paciente_id') = (to_jsonb(old) - 'paciente_id') then
    return new;
  end if;
  if not privado.en_proceso() then
    raise exception 'La orden de laboratorio se actualiza con «Enviar», «Recibir» o «Cancelar»';
  end if;
  if (to_jsonb(new) - array['estado', 'fecha_envio', 'fecha_entrega_prevista', 'fecha_recepcion', 'costo_centimos',
                            'motivo_cancelacion', 'updated_at'])
     is distinct from (to_jsonb(old) - array['estado', 'fecha_envio', 'fecha_entrega_prevista', 'fecha_recepcion',
                                             'costo_centimos', 'motivo_cancelacion', 'updated_at']) then
    raise exception 'La prescripción de la orden no cambia: cancélala y haz otra';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger proteger before update on public.orden_laboratorio
  for each row execute function privado.proteger_orden_laboratorio();

-- ---------------------------------------------------------------------------
-- Cambios de estado
-- ---------------------------------------------------------------------------
create function privado.orden_para_actualizar(id_orden uuid) returns public.orden_laboratorio
language plpgsql security definer set search_path = '' as $$
declare
  v public.orden_laboratorio;
begin
  if not privado.ve_clinico() then
    raise exception 'El laboratorio lo registran el cirujano dentista o la asistente';
  end if;
  select * into v from public.orden_laboratorio where id = id_orden and clinica_id = privado.clinica_actual() for update;
  if v.id is null then
    raise exception 'Orden no encontrada';
  end if;
  return v;
end $$;

-- Enviar (por enviar → en laboratorio) o, ya enviada, cambiar la entrega prevista.
create function public.enviar_orden_laboratorio(id_orden uuid, envio date, entrega_prevista date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.orden_laboratorio := privado.orden_para_actualizar(id_orden);
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_previo text := coalesce(current_setting('dental.proceso', true), '');
begin
  if v.estado not in ('por_enviar', 'en_laboratorio') then
    raise exception 'La orden ya está recibida o cancelada';
  end if;
  if envio is null or entrega_prevista is null then
    raise exception 'Indica la fecha de envío y la de entrega prevista';
  end if;
  if envio > v_hoy then
    raise exception 'La fecha de envío no puede ser futura';
  end if;
  if entrega_prevista < envio then
    raise exception 'La entrega prevista no puede ser anterior al envío';
  end if;
  if v.estado = 'en_laboratorio' and envio is distinct from v.fecha_envio then
    raise exception 'La orden ya se envió: solo cambia la entrega prevista';
  end if;
  perform set_config('dental.proceso', 'on', true);
  update public.orden_laboratorio
     set estado = 'en_laboratorio', fecha_envio = envio, fecha_entrega_prevista = entrega_prevista
   where id = v.id;
  perform set_config('dental.proceso', v_previo, true);
end $$;

create function public.recibir_orden_laboratorio(id_orden uuid, recepcion date, costo integer)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.orden_laboratorio := privado.orden_para_actualizar(id_orden);
  v_previo text := coalesce(current_setting('dental.proceso', true), '');
begin
  if v.estado <> 'en_laboratorio' then
    raise exception 'Solo se recibe una orden enviada al laboratorio';
  end if;
  if recepcion is null or recepcion > (now() at time zone 'America/Lima')::date then
    raise exception 'Indica la fecha de recepción (no futura)';
  end if;
  if recepcion < v.fecha_envio then
    raise exception 'La recepción no puede ser anterior al envío';
  end if;
  if costo is not null and (costo < 0 or costo > 10000000) then
    raise exception 'Costo inválido';
  end if;
  perform set_config('dental.proceso', 'on', true);
  update public.orden_laboratorio
     set estado = 'recibida', fecha_recepcion = recepcion, costo_centimos = coalesce(costo, costo_centimos)
   where id = v.id;
  perform set_config('dental.proceso', v_previo, true);
end $$;

create function public.cancelar_orden_laboratorio(id_orden uuid, motivo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.orden_laboratorio := privado.orden_para_actualizar(id_orden);
  v_previo text := coalesce(current_setting('dental.proceso', true), '');
begin
  if v.estado not in ('por_enviar', 'en_laboratorio') then
    raise exception 'La orden ya está recibida o cancelada';
  end if;
  if motivo is null or char_length(btrim(motivo)) < 5 then
    raise exception 'Escribe el motivo de la cancelación';
  end if;
  perform set_config('dental.proceso', 'on', true);
  update public.orden_laboratorio set estado = 'cancelada', motivo_cancelacion = left(btrim(motivo), 300) where id = v.id;
  perform set_config('dental.proceso', v_previo, true);
end $$;

revoke all on function public.enviar_orden_laboratorio(uuid, date, date) from public, anon;
revoke all on function public.recibir_orden_laboratorio(uuid, date, integer) from public, anon;
revoke all on function public.cancelar_orden_laboratorio(uuid, text) from public, anon;
grant execute on function public.enviar_orden_laboratorio(uuid, date, date) to authenticated;
grant execute on function public.recibir_orden_laboratorio(uuid, date, integer) to authenticated;
grant execute on function public.cancelar_orden_laboratorio(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS. Sin DELETE (regla 1).
-- ---------------------------------------------------------------------------
create policy laboratorio_select on public.laboratorio for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and ((select privado.ve_clinico()) or (select privado.rol_actual()) = 'admin'));
create policy laboratorio_insert on public.laboratorio for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin');
create policy laboratorio_update on public.laboratorio for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.rol_actual()) = 'admin')
  with check (clinica_id = (select privado.clinica_actual()));
create policy orden_laboratorio_select on public.orden_laboratorio for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy orden_laboratorio_insert on public.orden_laboratorio for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));

revoke all on public.laboratorio, public.orden_laboratorio from anon, authenticated;
grant select on public.laboratorio, public.orden_laboratorio to authenticated;
grant insert (clinica_id, nombre, telefono, contacto) on public.laboratorio to authenticated;
grant update (nombre, telefono, contacto, activo) on public.laboratorio to authenticated;
grant insert (clinica_id, item_plan_id, laboratorio_id, pieza, tipo_trabajo, color, indicaciones, costo_centimos)
  on public.orden_laboratorio to authenticated;

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
  n_laboratorio int;
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
  update public.orden_laboratorio set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_laboratorio = row_count;
  return jsonb_build_object('archivos', n_archivos, 'consentimientos', n_consentimientos, 'recetas', n_recetas,
                            'constancias', n_constancias, 'interconsultas', n_interconsultas,
                            'periodontogramas', n_periodontogramas, 'registros_especialidad', n_especialidad,
                            'ordenes_laboratorio', n_laboratorio);
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
                            'implante_fase', 'cirugia_registro', 'odontopediatria_registro', 'orden_laboratorio')
              or (select privado.es_dentista())));
