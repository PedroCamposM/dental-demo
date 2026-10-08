-- Etapa 3 (v2): historia clínica versionada, signos vitales y alertas clínicas.
-- Aditiva: tablas nuevas, dos funciones y la fusión de pacientes ampliada.
--
-- Regla 1: los datos clínicos nunca se borran. El cuestionario no se edita: cada
-- actualización es una versión nueva con fecha y autor. Los signos vitales mal
-- registrados se anulan con motivo.
-- Regla 4: las alertas (alergias, anticoagulación, condiciones sistémicas,
-- embarazo) se muestran en toda vista del paciente, también a recepción, mediante
-- una función que solo devuelve esos datos. Solo se muestra lo registrado.

-- Paciente vigente, esperando a una fusión en curso (bloqueo compartido): si la
-- fusión anula al paciente mientras se registra algo, el registro se rechaza en
-- vez de quedar en el duplicado anulado.
create function privado.validar_paciente_vigente_bloqueando() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_anulado timestamptz;
begin
  select anulado_at into v_anulado from public.paciente
   where id = new.paciente_id
     and (current_user <> 'authenticated' or clinica_id = privado.clinica_actual())
   for share;
  if v_anulado is not null then
    raise exception 'El paciente está anulado: registra la atención en el paciente vigente';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Cuestionario de salud (anamnesis y antecedentes), versionado
-- ---------------------------------------------------------------------------
create table public.cuestionario_salud (
  id                         uuid primary key default gen_random_uuid(),
  clinica_id                 uuid not null,
  paciente_id                uuid not null,
  version                    smallint not null check (version >= 1),
  registrado_por             uuid default auth.uid(),
  registrado_at              timestamptz not null default now(),
  -- Anamnesis
  motivo_consulta            text not null check (char_length(btrim(motivo_consulta)) between 3 and 500),
  enfermedad_actual          text check (char_length(enfermedad_actual) <= 2000),
  -- Antecedentes médicos
  enfermedades               text[] not null default '{}' check (enfermedades <@ array[
                               'hipertension', 'diabetes', 'cardiopatia', 'asma', 'epilepsia', 'hepatitis', 'vih',
                               'coagulacion', 'renal', 'tiroides', 'cancer', 'osteoporosis']),
  enfermedades_otras         text check (char_length(enfermedades_otras) <= 500),
  cirugias                   text check (char_length(cirugias) <= 1000),
  hospitalizaciones          text check (char_length(hospitalizaciones) <= 1000),
  medicacion                 text check (char_length(medicacion) <= 1000),
  anticoagulado              boolean not null default false,
  anticoagulante             text check (char_length(anticoagulante) <= 200),
  alergias                   text[] not null default '{}' check (cardinality(alergias) <= 15),
  embarazo                   text not null default 'no_aplica' check (embarazo in ('no', 'si', 'no_sabe', 'no_aplica')),
  semanas_gestacion          smallint check (semanas_gestacion between 1 and 42),
  lactancia                  boolean not null default false,
  -- Hábitos y antecedentes odontológicos
  habitos                    text[] not null default '{}' check (habitos <@ array[
                               'tabaco', 'alcohol', 'bruxismo', 'onicofagia', 'succion_digital', 'respiracion_bucal',
                               'morder_objetos']),
  habitos_otros              text check (char_length(habitos_otros) <= 500),
  antecedentes_odontologicos text check (char_length(antecedentes_odontologicos) <= 2000),
  observaciones              text check (char_length(observaciones) <= 2000),
  created_at                 timestamptz not null default now(),
  unique (clinica_id, id),
  unique (paciente_id, version),
  foreign key (clinica_id, paciente_id)    references public.paciente (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  constraint cuestionario_anticoagulante check (not anticoagulado or char_length(btrim(coalesce(anticoagulante, ''))) >= 2),
  constraint cuestionario_semanas check (semanas_gestacion is null or embarazo = 'si')
);
alter table public.cuestionario_salud enable row level security;
create index cuestionario_paciente_idx on public.cuestionario_salud (paciente_id, registrado_at desc);

-- Número de versión correlativo por paciente (bloquea al paciente: dos registros
-- simultáneos no obtienen el mismo número). Alergias sin vacíos ni repetidas.
create function privado.preparar_cuestionario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.paciente where id = new.paciente_id
     and (current_user <> 'authenticated' or clinica_id = privado.clinica_actual()) for update;
  select coalesce(max(version), 0) + 1 into new.version from public.cuestionario_salud where paciente_id = new.paciente_id;
  new.alergias := coalesce((select array_agg(distinct a order by a)
                            from (select btrim(x) as a from unnest(new.alergias) x) t
                            where char_length(a) between 2 and 80), '{}');
  if not new.anticoagulado then new.anticoagulante := null; end if;
  return new;
end $$;
create trigger preparar before insert on public.cuestionario_salud
  for each row execute function privado.preparar_cuestionario();
create trigger paciente_vigente before insert on public.cuestionario_salud
  for each row execute function privado.validar_paciente_vigente_bloqueando();
create trigger auditar after insert on public.cuestionario_salud
  for each row execute function privado.auditar_simple();

-- Una versión registrada no cambia (solo la fusión de pacientes la reasigna).
create function privado.inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.en_fusion() then
    return new;
  end if;
  raise exception 'Este registro clínico no se modifica: registra una versión nueva';
end $$;
create trigger inmutable before update on public.cuestionario_salud
  for each row execute function privado.inmutable();

-- ---------------------------------------------------------------------------
-- Signos vitales por consulta (los puede registrar el asistente)
-- ---------------------------------------------------------------------------
create table public.signos_vitales (
  id                       uuid primary key default gen_random_uuid(),
  clinica_id               uuid not null,
  paciente_id              uuid not null,
  cita_id                  uuid,
  registrado_por           uuid default auth.uid(),
  registrado_at            timestamptz not null default now(),
  presion_sistolica        smallint check (presion_sistolica between 50 and 260),
  presion_diastolica       smallint check (presion_diastolica between 30 and 160),
  frecuencia_cardiaca      smallint check (frecuencia_cardiaca between 30 and 220),
  frecuencia_respiratoria  smallint check (frecuencia_respiratoria between 6 and 60),
  temperatura_c            numeric(3, 1) check (temperatura_c between 34 and 42),
  peso_kg                  numeric(5, 2) check (peso_kg between 1 and 300),
  talla_cm                 numeric(4, 1) check (talla_cm between 30 and 230),
  anulado_at               timestamptz,
  anulado_por              uuid references public.usuario (id),
  motivo_anulacion         text,
  created_at               timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id)    references public.paciente (clinica_id, id),
  foreign key (clinica_id, cita_id)        references public.cita (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  constraint signos_presion_completa check ((presion_sistolica is null) = (presion_diastolica is null)),
  constraint signos_presion_coherente check (presion_sistolica is null or presion_sistolica > presion_diastolica),
  constraint signos_algun_dato check (num_nonnulls(presion_sistolica, frecuencia_cardiaca, frecuencia_respiratoria,
                                                    temperatura_c, peso_kg, talla_cm) > 0),
  constraint signos_anulacion_completa check ((anulado_at is null) = (motivo_anulacion is null)),
  check (motivo_anulacion is null or char_length(btrim(motivo_anulacion)) >= 3)
);
alter table public.signos_vitales enable row level security;
create index signos_paciente_idx on public.signos_vitales (paciente_id, registrado_at desc);
create trigger paciente_vigente before insert on public.signos_vitales
  for each row execute function privado.validar_paciente_vigente_bloqueando();

-- La cita es del mismo paciente; la anulación lleva la hora del servidor.
create function privado.validar_signos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.cita_id is not null
     and not exists (select 1 from public.cita where id = new.cita_id and paciente_id = new.paciente_id) then
    raise exception 'La cita no corresponde a este paciente';
  end if;
  if tg_op = 'UPDATE' and old.anulado_at is null and new.anulado_at is not null then
    new.anulado_at := now();
  end if;
  return new;
end $$;
create trigger validar before insert or update on public.signos_vitales
  for each row execute function privado.validar_signos();
create trigger solo_anular before update on public.signos_vitales
  for each row execute function privado.solo_anular();
create trigger auditar after insert or update on public.signos_vitales
  for each row execute function privado.auditar();

-- ---------------------------------------------------------------------------
-- RLS: la historia la ven y registran los cirujanos dentistas y el asistente
-- (ve_clinico; decisión de Pedro, 2026-10-08). Recepción no ve nada de esto.
-- Nada se borra.
-- ---------------------------------------------------------------------------
create policy cuestionario_select on public.cuestionario_salud for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy cuestionario_insert on public.cuestionario_salud for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico())
              and registrado_por = (select auth.uid()));

create policy signos_select on public.signos_vitales for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy signos_insert on public.signos_vitales for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico())
              and registrado_por = (select auth.uid()));
create policy signos_anular on public.signos_vitales for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()))
  with check (clinica_id = (select privado.clinica_actual()) and anulado_por = (select auth.uid()));

revoke all on public.cuestionario_salud, public.signos_vitales from anon, authenticated;
grant select on public.cuestionario_salud to authenticated;
grant insert (id, clinica_id, paciente_id, registrado_por, motivo_consulta, enfermedad_actual, enfermedades,
              enfermedades_otras, cirugias, hospitalizaciones, medicacion, anticoagulado, anticoagulante, alergias,
              embarazo, semanas_gestacion, lactancia, habitos, habitos_otros, antecedentes_odontologicos, observaciones)
  on public.cuestionario_salud to authenticated;
grant select on public.signos_vitales to authenticated;
grant insert (id, clinica_id, paciente_id, cita_id, registrado_por, presion_sistolica, presion_diastolica,
              frecuencia_cardiaca, frecuencia_respiratoria, temperatura_c, peso_kg, talla_cm)
  on public.signos_vitales to authenticated;
grant update (anulado_at, anulado_por, motivo_anulacion) on public.signos_vitales to authenticated;

-- ---------------------------------------------------------------------------
-- Alertas clínicas: solo lo registrado en la versión vigente del cuestionario.
-- Todo el equipo de la clínica (también recepción) las ve; nada más de la historia.
-- ---------------------------------------------------------------------------
create function public.alertas_pacientes(pacientes uuid[])
returns table (paciente_id uuid, alergias text[], anticoagulante text, enfermedades text[],
               embarazo text, semanas_gestacion smallint, actualizado_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (c.paciente_id)
         c.paciente_id, c.alergias, case when c.anticoagulado then c.anticoagulante end,
         -- Las condiciones sistémicas, con nombre, solo para el equipo clínico; recepción
         -- solo sabe que hay alguna registrada (dato clínico reservado, regla 9).
         case when privado.ve_clinico() then c.enfermedades
              when cardinality(c.enfermedades) > 0 or c.enfermedades_otras is not null then array['reservado']
              else '{}'::text[] end,
         c.embarazo, c.semanas_gestacion, c.registrado_at
    from public.cuestionario_salud c
   where c.clinica_id = privado.clinica_actual()
     and c.paciente_id = any (pacientes)
   order by c.paciente_id, c.registrado_at desc, c.version desc
$$;
revoke all on function public.alertas_pacientes(uuid[]) from public, anon;
grant execute on function public.alertas_pacientes(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Acceso a la historia clínica: queda en la auditoría (una vez cada 10 minutos
-- por usuario y paciente, para no llenarla con recargas).
-- ---------------------------------------------------------------------------
create function public.registrar_lectura_historia(id_paciente uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
begin
  if not privado.ve_clinico() then
    raise exception 'Tu rol no accede a la historia clínica';
  end if;
  if not exists (select 1 from public.paciente where id = id_paciente and clinica_id = v_clinica) then
    raise exception 'Paciente no encontrado';
  end if;
  if exists (select 1 from public.auditoria
              where clinica_id = v_clinica and tabla = 'historia_clinica' and registro_id = id_paciente
                and accion = 'lectura' and usuario_id = auth.uid() and ocurrido_at > now() - interval '10 minutes') then
    return;
  end if;
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (v_clinica, 'historia_clinica', id_paciente, 'lectura', auth.uid(), null, null);
end $$;
revoke all on function public.registrar_lectura_historia(uuid) from public, anon;
grant execute on function public.registrar_lectura_historia(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Fusión de pacientes: también mueve la historia y los signos vitales. Las
-- versiones del duplicado se numeran a continuación de las del que se conserva.
-- ---------------------------------------------------------------------------
create or replace function public.fusionar_pacientes(duplicado uuid, conservar uuid, motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_dup public.paciente;
  v_con public.paciente;
  v_movidos jsonb;
  v_desfase int;
  n_planes int; n_notas int; n_odontogramas int; n_citas int; n_seguimientos int; n_historia int; n_signos int;
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
      enfermedades_otras, medicacion, anticoagulado, anticoagulante, alergias, embarazo, semanas_gestacion, lactancia,
      habitos, observaciones)
    select v_clinica, conservar, auth.uid(), 'Versión conciliada al fusionar registros duplicados',
           (select coalesce(array_agg(distinct e order by e), '{}') from unnest(a.enfermedades || b.enfermedades) e),
           nullif(concat_ws('; ', a.enfermedades_otras, nullif(b.enfermedades_otras, a.enfermedades_otras)), ''),
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
    apoderado_parentesco = coalesce(p.apoderado_parentesco, v_dup.apoderado_parentesco)
  where p.id = conservar;

  perform set_config('dental.fusion', 'on', true);
  update public.paciente set
    anulado_at = now(), anulado_por = auth.uid(), fusionado_en = conservar,
    motivo_anulacion = 'Fusionado con ' || v_con.nombres || ' ' || v_con.apellidos || ': ' || btrim(motivo)
  where id = duplicado;
  perform set_config('dental.fusion', 'off', true);

  v_movidos := jsonb_build_object('planes', n_planes, 'notas', n_notas, 'odontogramas', n_odontogramas,
                                  'citas', n_citas, 'seguimientos', n_seguimientos,
                                  'historia', n_historia, 'signos_vitales', n_signos);
  insert into public.auditoria (clinica_id, tabla, registro_id, accion, usuario_id, antes, despues)
  values (v_clinica, 'paciente', duplicado, 'fusion', auth.uid(), to_jsonb(v_dup),
          jsonb_build_object('conservar', conservar, 'motivo', btrim(motivo), 'movidos', v_movidos));
  return v_movidos;
end $$;

-- Auditoría: el contenido de la historia y los signos vitales, como el resto de lo
-- clínico, solo lo lee un administrador que además es cirujano dentista (regla 9).
drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica')
              or (select privado.es_dentista())));
