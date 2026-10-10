-- Etapa 7 (v2), rebanada 3: recetas e indicaciones, constancias de atención y
-- certificados de descanso.
--
-- Aditiva. Reglas:
-- - El profesional escribe medicamento, presentación, dosis, frecuencia y duración.
--   El sistema NUNCA sugiere dosis (regla 11): las plantillas de receta son del propio
--   profesional y solo copian lo que él escribió.
-- - Recetas, constancias y certificados los emite solo el cirujano dentista (con su
--   colegiatura) y quedan en la historia: no se editan ni se borran; se anulan con motivo.
-- - Se emiten de una vez con funciones (receta con sus medicamentos, atómica).

-- ---------------------------------------------------------------------------
-- Recetas
-- ---------------------------------------------------------------------------
create table public.receta (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null,
  paciente_id       uuid not null,
  profesional_id    uuid not null,
  nota_id           uuid,
  indicaciones      text check (char_length(indicaciones) <= 2000),
  emitida_at        timestamptz not null default now(),
  anulado_at        timestamptz,
  anulado_por       uuid,
  motivo_anulacion  text check (char_length(motivo_anulacion) <= 200),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, profesional_id) references public.usuario (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint receta_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null)
                                              and (anulado_at is null) = (anulado_por is null))
);
alter table public.receta enable row level security;
create index receta_paciente_idx on public.receta (paciente_id, emitida_at desc);

create table public.receta_item (
  id            uuid primary key default gen_random_uuid(),
  clinica_id    uuid not null,
  receta_id     uuid not null,
  orden         smallint not null check (orden between 1 and 20),
  medicamento   text not null check (char_length(btrim(medicamento)) between 2 and 200),
  presentacion  text not null check (char_length(btrim(presentacion)) between 1 and 120),
  dosis         text not null check (char_length(btrim(dosis)) between 1 and 120),
  frecuencia    text not null check (char_length(btrim(frecuencia)) between 1 and 120),
  duracion      text not null check (char_length(btrim(duracion)) between 1 and 120),
  indicaciones  text check (char_length(indicaciones) <= 300),
  unique (receta_id, orden),
  foreign key (clinica_id, receta_id) references public.receta (clinica_id, id)
);
alter table public.receta_item enable row level security;

-- Plantillas propias del profesional (nunca del sistema).
create table public.plantilla_receta (
  id              uuid primary key default gen_random_uuid(),
  clinica_id      uuid not null,
  profesional_id  uuid not null default auth.uid(),
  nombre          text not null check (char_length(btrim(nombre)) between 3 and 80),
  items           jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  indicaciones    text check (char_length(indicaciones) <= 2000),
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  foreign key (clinica_id, profesional_id) references public.usuario (clinica_id, id)
);
alter table public.plantilla_receta enable row level security;
create unique index plantilla_receta_nombre on public.plantilla_receta (profesional_id, lower(btrim(nombre))) where activa;

-- ---------------------------------------------------------------------------
-- Constancias de atención y certificados de descanso
-- ---------------------------------------------------------------------------
create table public.constancia (
  id                uuid primary key default gen_random_uuid(),
  clinica_id        uuid not null,
  paciente_id       uuid not null,
  profesional_id    uuid not null,
  tipo              text not null check (tipo in ('atencion', 'descanso')),
  -- Atención: fecha y horas en que se atendió
  fecha_atencion    date not null,
  hora_inicio       time,
  hora_fin          time,
  -- Descanso: desde cuándo y cuántos días
  descanso_desde    date,
  descanso_dias     smallint check (descanso_dias between 1 and 30),
  -- Opcional: el paciente puede no querer que el diagnóstico figure
  cie10             text references public.catalogo_cie10 (codigo),
  observaciones     text check (char_length(observaciones) <= 500),
  emitida_at        timestamptz not null default now(),
  anulado_at        timestamptz,
  anulado_por       uuid,
  motivo_anulacion  text check (char_length(motivo_anulacion) <= 200),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, profesional_id) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint constancia_tipo check (
    (tipo = 'atencion' and descanso_desde is null and descanso_dias is null)
    or (tipo = 'descanso' and descanso_desde is not null and descanso_dias is not null
        and descanso_desde >= fecha_atencion and descanso_desde <= fecha_atencion + 3)),
  constraint constancia_horas check (hora_fin is null or (hora_inicio is not null and hora_fin > hora_inicio)),
  constraint constancia_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null)
                                                 and (anulado_at is null) = (anulado_por is null))
);
alter table public.constancia enable row level security;
create index constancia_paciente_idx on public.constancia (paciente_id, emitida_at desc);

create function privado.preparar_constancia() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.profesional_id := auth.uid();
    new.emitida_at := now();
    new.anulado_at := null; new.anulado_por := null; new.motivo_anulacion := null;
  end if;
  if new.fecha_atencion > (now() at time zone 'America/Lima')::date then
    raise exception 'La fecha de atención no puede ser futura';
  end if;
  if new.fecha_atencion < (now() at time zone 'America/Lima')::date - 365 then
    raise exception 'La fecha de atención es de hace más de un año';
  end if;
  return new;
end $$;
create trigger preparar before insert on public.constancia
  for each row execute function privado.preparar_constancia();

-- ---------------------------------------------------------------------------
-- Comunes: paciente vigente, solo se anulan, auditoría
-- ---------------------------------------------------------------------------
create trigger paciente_vigente before insert on public.receta
  for each row execute function privado.validar_paciente_vigente();
create trigger paciente_vigente before insert on public.constancia
  for each row execute function privado.validar_paciente_vigente();
create trigger solo_anular before update on public.receta
  for each row execute function privado.solo_anular();
create trigger solo_anular before update on public.constancia
  for each row execute function privado.solo_anular();
create trigger auditar after insert or update on public.receta
  for each row execute function privado.auditar();
create trigger auditar after insert or update on public.constancia
  for each row execute function privado.auditar();

-- ---------------------------------------------------------------------------
-- Emitir receta (atómica, con sus medicamentos)
-- ---------------------------------------------------------------------------
create function public.emitir_receta(id_paciente uuid, id_nota uuid, indicaciones text, items jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_receta uuid;
  v_item jsonb;
  v_orden int := 0;
begin
  if not privado.es_dentista() then
    raise exception 'Solo el cirujano dentista emite recetas';
  end if;
  if not exists (select 1 from public.paciente where id = id_paciente and clinica_id = v_clinica) then
    raise exception 'Paciente no encontrado';
  end if;
  if id_nota is not null and not exists (select 1 from public.nota_evolucion
                                          where id = id_nota and paciente_id = id_paciente and anulado_at is null) then
    raise exception 'La sesión no corresponde a este paciente';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 20 then
    raise exception 'La receta lleva entre 1 y 20 medicamentos';
  end if;
  insert into public.receta (clinica_id, paciente_id, profesional_id, nota_id, indicaciones)
  values (v_clinica, id_paciente, auth.uid(), id_nota, nullif(btrim(indicaciones), ''))
  returning id into v_receta;
  for v_item in select * from jsonb_array_elements(items) loop
    v_orden := v_orden + 1;
    insert into public.receta_item (clinica_id, receta_id, orden, medicamento, presentacion, dosis, frecuencia, duracion,
                                    indicaciones)
    values (v_clinica, v_receta, v_orden, btrim(v_item ->> 'medicamento'), btrim(v_item ->> 'presentacion'),
            btrim(v_item ->> 'dosis'), btrim(v_item ->> 'frecuencia'), btrim(v_item ->> 'duracion'),
            nullif(btrim(v_item ->> 'indicaciones'), ''));
  end loop;
  return v_receta;
end $$;
revoke all on function public.emitir_receta(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.emitir_receta(uuid, uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: ve el personal clínico; emite y anula el cirujano dentista
-- ---------------------------------------------------------------------------
create policy receta_select on public.receta for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy receta_anular on public.receta for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));
create policy receta_item_select on public.receta_item for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
revoke all on public.receta, public.receta_item from anon, authenticated;
grant select on public.receta, public.receta_item to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.receta to authenticated;

create policy plantilla_receta_select on public.plantilla_receta for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and profesional_id = (select auth.uid()));
create policy plantilla_receta_insert on public.plantilla_receta for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and profesional_id = (select auth.uid())
              and (select privado.es_dentista()));
create policy plantilla_receta_update on public.plantilla_receta for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and profesional_id = (select auth.uid()))
  with check (clinica_id = (select privado.clinica_actual()) and profesional_id = (select auth.uid()));
revoke all on public.plantilla_receta from anon, authenticated;
grant select on public.plantilla_receta to authenticated;
grant insert (id, clinica_id, profesional_id, nombre, items, indicaciones) on public.plantilla_receta to authenticated;
-- Sin DELETE (regla 8): una plantilla que ya no sirve se desactiva.
grant update (activa) on public.plantilla_receta to authenticated;

create policy constancia_select on public.constancia for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy constancia_insert on public.constancia for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()));
create policy constancia_anular on public.constancia for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.es_dentista()))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));
revoke all on public.constancia from anon, authenticated;
grant select on public.constancia to authenticated;
grant insert (id, clinica_id, paciente_id, profesional_id, tipo, fecha_atencion, hora_inicio, hora_fin, descanso_desde,
              descanso_dias, cie10, observaciones)
  on public.constancia to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.constancia to authenticated;

-- ---------------------------------------------------------------------------
-- Fusión y auditoría
-- ---------------------------------------------------------------------------
create or replace function privado.fusion_mover_extra(duplicado uuid, conservar uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n_archivos int;
  n_consentimientos int;
  n_recetas int;
  n_constancias int;
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
  update public.receta set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_recetas = row_count;
  update public.constancia set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_constancias = row_count;
  return jsonb_build_object('archivos', n_archivos, 'consentimientos', n_consentimientos,
                            'recetas', n_recetas, 'constancias', n_constancias);
end $$;

drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica', 'examen_clinico', 'diagnostico',
                            'diagnostico_adenda', 'evolucion_adenda', 'evolucion_item', 'archivo_clinico',
                            'consentimiento', 'receta', 'constancia')
              or (select privado.es_dentista())));
