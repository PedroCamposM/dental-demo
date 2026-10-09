-- Etapa 7 (v2), rebanada 1: imágenes y archivos clínicos en Storage privado.
-- Aditiva: bucket privado `clinico`, tabla `archivo_clinico` (radiografías, fotos y
-- documentos por fecha, pieza y sesión) y un punto de extensión para la fusión de
-- pacientes, que las etapas siguientes amplían sin reescribir fusionar_pacientes().
--
-- Ruta de cada archivo: <clinica_id>/<paciente_id>/<uuid>.<ext>. Las políticas de
-- Storage la usan para que una clínica nunca vea archivos de otra y para que solo el
-- personal clínico (dentistas y asistente) los vea y suba (regla 9). No hay UPDATE ni
-- DELETE de objetos (regla 1): un archivo equivocado se anula con motivo.
-- Las imágenes se muestran con URLs firmadas de corta duración (las genera la app).

-- ---------------------------------------------------------------------------
-- Bucket privado
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinico', 'clinico', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy clinico_select on storage.objects for select to authenticated
  using (bucket_id = 'clinico'
         and (storage.foldername(name))[1] = (select privado.clinica_actual())::text
         and (select privado.ve_clinico()));
create policy clinico_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'clinico'
              and (storage.foldername(name))[1] = (select privado.clinica_actual())::text
              and (select privado.ve_clinico())
              and exists (select 1 from public.paciente p
                           where p.id::text = (storage.foldername(name))[2]
                             and p.clinica_id = (select privado.clinica_actual()) and p.anulado_at is null));

-- ---------------------------------------------------------------------------
-- Archivos clínicos
-- ---------------------------------------------------------------------------
create table public.archivo_clinico (
  id               uuid primary key default gen_random_uuid(),
  clinica_id       uuid not null,
  paciente_id      uuid not null,
  -- consentimiento e interconsulta: los suben sus propios flujos (etapas 7.2 y 7.5).
  tipo             text not null check (tipo in ('radiografia', 'foto_intraoral', 'foto_extraoral', 'documento',
                                                  'consentimiento', 'interconsulta')),
  ruta             text not null unique,
  nombre           text check (char_length(nombre) <= 200),
  mime             text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  bytes            integer not null check (bytes > 0 and bytes <= 10485760),
  -- Fecha de la toma (o del documento), no la de subida.
  tomada_el        date not null,
  pieza            smallint check (pieza is null or privado.es_pieza_fdi(pieza)),
  nota_id          uuid,
  descripcion      text check (char_length(descripcion) <= 500),
  subido_por       uuid default auth.uid(),
  subido_at        timestamptz not null default now(),
  anulado_at       timestamptz,
  anulado_por      uuid,
  motivo_anulacion text,
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  foreign key (clinica_id, subido_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  constraint archivo_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null)
                                              and (anulado_at is null) = (anulado_por is null))
);
alter table public.archivo_clinico enable row level security;
create index archivo_paciente_idx on public.archivo_clinico (paciente_id, tomada_el desc);

create function privado.validar_archivo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- La ruta es de esta clínica y este paciente, y el objeto ya está en el bucket.
  if new.ruta !~ ('^' || new.clinica_id || '/' || new.paciente_id || '/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$') then
    raise exception 'Ruta de archivo inválida';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'clinico' and o.name = new.ruta) then
    raise exception 'El archivo no se terminó de subir: inténtalo de nuevo';
  end if;
  if new.nota_id is not null and not exists (select 1 from public.nota_evolucion n
                                              where n.id = new.nota_id and n.paciente_id = new.paciente_id) then
    raise exception 'La sesión no corresponde a este paciente';
  end if;
  if new.tomada_el > (now() at time zone 'America/Lima')::date then
    raise exception 'La fecha de la imagen no puede ser futura';
  end if;
  -- Desde la app (con usuario): la fecha de subida la pone la base; el autor lo exige RLS.
  if auth.uid() is not null then
    new.subido_at := now();
  end if;
  return new;
end $$;
create trigger validar before insert on public.archivo_clinico
  for each row execute function privado.validar_archivo();
create trigger paciente_vigente before insert on public.archivo_clinico
  for each row execute function privado.validar_paciente_vigente();
create trigger solo_anular before update on public.archivo_clinico
  for each row execute function privado.solo_anular();
create trigger auditar after insert or update on public.archivo_clinico
  for each row execute function privado.auditar();

create policy archivo_select on public.archivo_clinico for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy archivo_insert on public.archivo_clinico for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico())
              and subido_por = (select auth.uid())
              and tipo in ('radiografia', 'foto_intraoral', 'foto_extraoral', 'documento'));
-- Anula quien lo subió o un cirujano dentista (con motivo, a nombre propio).
create policy archivo_anular on public.archivo_clinico for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico())
         and (subido_por = (select auth.uid()) or (select privado.es_dentista())))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

revoke all on public.archivo_clinico from anon, authenticated;
grant select on public.archivo_clinico to authenticated;
grant insert (id, clinica_id, paciente_id, tipo, ruta, nombre, mime, bytes, tomada_el, pieza, nota_id, descripcion,
              subido_por)
  on public.archivo_clinico to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.archivo_clinico to authenticated;

-- ---------------------------------------------------------------------------
-- Fusión de pacientes: punto de extensión para las tablas nuevas de la v2.
-- fusionar_pacientes() llama a privado.fusion_mover_extra() (dentro de la marca
-- dental.fusion) y suma lo que devuelve a «movidos». Cada etapa lo redefine.
-- ---------------------------------------------------------------------------
create function privado.fusion_mover_extra(duplicado uuid, conservar uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n_archivos int;
begin
  update public.archivo_clinico set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_archivos = row_count;
  return jsonb_build_object('archivos', n_archivos);
end $$;
revoke all on function privado.fusion_mover_extra(uuid, uuid) from public, anon, authenticated;

create or replace function public.fusionar_pacientes(duplicado uuid, conservar uuid, motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_dup public.paciente;
  v_con public.paciente;
  v_movidos jsonb;
  v_extra jsonb;
  v_desfase int;
  n_planes int; n_notas int; n_odontogramas int; n_citas int; n_seguimientos int; n_historia int; n_signos int;
  n_examenes int; n_diagnosticos int;
begin
  if privado.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el administrador puede fusionar pacientes';
  end if;
  if duplicado = conservar then
    raise exception 'Elige dos pacientes distintos';
  end if;
  if length(btrim(coalesce(motivo, ''))) < 5 then
    raise exception 'Indica el motivo de la fusión';
  end if;
  -- Bloquea ambos en orden de id: dos fusiones cruzadas no se bloquean entre sí.
  perform 1 from public.paciente where id in (duplicado, conservar) and clinica_id = v_clinica order by id for update;
  select * into v_dup from public.paciente where id = duplicado and clinica_id = v_clinica;
  select * into v_con from public.paciente where id = conservar and clinica_id = v_clinica;
  if v_dup.id is null or v_con.id is null then
    raise exception 'Paciente no encontrado';
  end if;
  if v_dup.anulado_at is not null or v_con.anulado_at is not null then
    raise exception 'No se puede fusionar un paciente anulado';
  end if;

  perform set_config('dental.fusion', 'on', true);
  update public.plan_tratamiento set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_planes = row_count;
  update public.nota_evolucion set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_notas = row_count;
  update public.odontograma set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_odontogramas = row_count;
  update public.cita set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_citas = row_count;
  update public.seguimiento set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_seguimientos = row_count;
  select coalesce(max(version), 0) into v_desfase from public.cuestionario_salud where paciente_id = conservar;
  update public.cuestionario_salud set paciente_id = conservar, version = version + v_desfase where paciente_id = duplicado;
  get diagnostics n_historia = row_count;
  -- Si ambos tenían historia, una versión conciliada reúne lo que alerta (alergias,
  -- condiciones, anticoagulación, embarazo) para que ninguna alerta se pierda; queda
  -- marcada para revisión.
  if n_historia > 0 and v_desfase > 0 then
    insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, enfermedades,
      enfermedades_otras, antecedentes_familiares, medicacion, anticoagulado, anticoagulante, alergias, embarazo, semanas_gestacion, lactancia,
      habitos, observaciones)
    select v_clinica, conservar, auth.uid(), 'Versión conciliada al fusionar registros duplicados',
           (select coalesce(array_agg(distinct e order by e), '{}') from unnest(a.enfermedades || b.enfermedades) e),
           nullif(concat_ws('; ', a.enfermedades_otras, nullif(b.enfermedades_otras, a.enfermedades_otras)), ''),
           nullif(concat_ws('; ', a.antecedentes_familiares,
                            nullif(b.antecedentes_familiares, a.antecedentes_familiares)), ''),
           nullif(concat_ws('; ', a.medicacion, nullif(b.medicacion, a.medicacion)), ''),
           a.anticoagulado or b.anticoagulado,
           nullif(concat_ws('; ', case when a.anticoagulado then a.anticoagulante end,
                            case when b.anticoagulado and b.anticoagulante is distinct from a.anticoagulante
                                 then b.anticoagulante end), ''),
           (select coalesce(array_agg(distinct x order by x), '{}') from unnest(a.alergias || b.alergias) x),
           r.embarazo, r.semanas_gestacion, r.lactancia,
           (select coalesce(array_agg(distinct x order by x), '{}') from unnest(a.habitos || b.habitos) x),
           'Generada automáticamente al fusionar registros: revisar con el paciente.'
      from (select * from public.cuestionario_salud where paciente_id = conservar and version <= v_desfase
             order by registrado_at desc, version desc limit 1) a,
           (select * from public.cuestionario_salud where paciente_id = conservar and version > v_desfase
             order by registrado_at desc, version desc limit 1) b
      -- Embarazo: el registrado como «sí» prevalece; si no, el más reciente.
      cross join lateral (select * from public.cuestionario_salud where id in (a.id, b.id)
                           order by (embarazo = 'si') desc, registrado_at desc limit 1) r;
  end if;
  update public.signos_vitales set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_signos = row_count;
  update public.examen_clinico set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_examenes = row_count;
  update public.diagnostico set paciente_id = conservar where paciente_id = duplicado;
  get diagnostics n_diagnosticos = row_count;
  v_extra := privado.fusion_mover_extra(duplicado, conservar);
  perform set_config('dental.fusion', 'off', true);

  -- El documento pasa al que se conserva si este no tenía (se libera primero en el
  -- duplicado, porque el documento es único por clínica).
  if v_con.numero_documento is null and v_dup.numero_documento is not null then
    update public.paciente set numero_documento = null, dni = null where id = duplicado;
    update public.paciente set tipo_documento = v_dup.tipo_documento, numero_documento = v_dup.numero_documento
    where id = conservar;
  end if;

  -- Datos que solo tenía el duplicado pasan al que se conserva.
  update public.paciente p set
    telefono = coalesce(p.telefono, v_dup.telefono),
    sexo = coalesce(p.sexo, v_dup.sexo),
    ocupacion = coalesce(p.ocupacion, v_dup.ocupacion),
    direccion = coalesce(p.direccion, v_dup.direccion),
    contacto_emergencia_nombre = coalesce(p.contacto_emergencia_nombre, v_dup.contacto_emergencia_nombre),
    contacto_emergencia_telefono = coalesce(p.contacto_emergencia_telefono, v_dup.contacto_emergencia_telefono),
    contacto_emergencia_parentesco = coalesce(p.contacto_emergencia_parentesco, v_dup.contacto_emergencia_parentesco),
    consentimiento_datos_at = coalesce(p.consentimiento_datos_at, v_dup.consentimiento_datos_at),
    fecha_nacimiento = coalesce(p.fecha_nacimiento, v_dup.fecha_nacimiento),
    apoderado_nombre = coalesce(p.apoderado_nombre, v_dup.apoderado_nombre),
    apoderado_dni = coalesce(p.apoderado_dni, v_dup.apoderado_dni),
    apoderado_telefono = coalesce(p.apoderado_telefono, v_dup.apoderado_telefono),
    apoderado_parentesco = coalesce(p.apoderado_parentesco, v_dup.apoderado_parentesco),
    apoderado_direccion = coalesce(p.apoderado_direccion, v_dup.apoderado_direccion),
    lugar_nacimiento = coalesce(p.lugar_nacimiento, v_dup.lugar_nacimiento),
    procedencia = coalesce(p.procedencia, v_dup.procedencia),
    grupo_sanguineo = coalesce(p.grupo_sanguineo, v_dup.grupo_sanguineo),
    estado_civil = coalesce(p.estado_civil, v_dup.estado_civil),
    grado_instruccion = coalesce(p.grado_instruccion, v_dup.grado_instruccion),
    -- El seguro y su número van juntos: se toman del mismo registro.
    seguro = coalesce(p.seguro, v_dup.seguro),
    seguro_numero = case when p.seguro is not null then p.seguro_numero else v_dup.seguro_numero end,
    religion = coalesce(p.religion, v_dup.religion)
  where p.id = conservar;

  perform set_config('dental.fusion', 'on', true);
  update public.paciente set
    anulado_at = now(), anulado_por = auth.uid(), fusionado_en = conservar,
    motivo_anulacion = 'Fusionado con ' || v_con.nombres || ' ' || v_con.apellidos || ': ' || btrim(motivo)
  where id = duplicado;
  perform set_config('dental.fusion', 'off', true);

  v_movidos := jsonb_build_object('planes', n_planes, 'notas', n_notas, 'odontogramas', n_odontogramas,
                                  'citas', n_citas, 'seguimientos', n_seguimientos,
                                  'historia', n_historia, 'signos_vitales', n_signos,
                                  'examenes', n_examenes, 'diagnosticos', n_diagnosticos) || v_extra;
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (v_clinica, 'paciente', duplicado, 'fusion', auth.uid(), to_jsonb(v_dup),
          jsonb_build_object('conservar', conservar, 'motivo', btrim(motivo), 'movidos', v_movidos));
  return v_movidos;
end $$;

-- Auditoría: los archivos clínicos son contenido clínico (regla 9).
drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica', 'examen_clinico', 'diagnostico',
                            'diagnostico_adenda', 'evolucion_adenda', 'evolucion_item', 'archivo_clinico')
              or (select privado.es_dentista())));
