-- Etapa 21 (v2): plan de tratamiento por zona, pedido del odontólogo piloto (24-oct).
--
-- La profilaxis, el destartraje y otros procedimientos se planifican y cotizan por la zona
-- trabajada (un cuadrante, una arcada o la boca completa), no diente por diente.
--
-- Aditiva: `item_plan.zona` (null = por pieza o sin pieza, como hasta ahora) y
-- `procedimiento.cobro_por` (cómo se cotiza: por pieza, cuadrante, arcada o boca completa; el
-- plan propone esa zona y el precio base por unidad, y el odontólogo lo ajusta). Los ítems
-- existentes no cambian. copiar_plan copia la zona a la nueva versión o alternativa.

alter table public.procedimiento
  add column cobro_por text not null default 'pieza' check (cobro_por in ('pieza', 'cuadrante', 'arcada', 'boca'));
grant update (cobro_por) on public.procedimiento to authenticated;

alter table public.item_plan
  add column zona text check (zona in ('cuadrante_1', 'cuadrante_2', 'cuadrante_3', 'cuadrante_4',
                                       'arcada_superior', 'arcada_inferior', 'boca')),
  -- Una zona no lleva pieza ni superficies (son excluyentes).
  add constraint item_zona_sin_pieza check (zona is null or (pieza is null and superficies is null));

-- Profilaxis y destartraje ya se cotizaban como un solo ítem sin pieza: quedan «por boca
-- completa» (mismo precio, mismo significado). El resto sigue «por pieza».
update public.procedimiento set cobro_por = 'boca'
 where cobro_por = 'pieza' and (nombre ilike '%profilaxis%' or nombre ilike '%destartraje%');
-- Los que ya dicen «por cuadrante» en el nombre (p. ej. el raspado y alisado radicular).
update public.procedimiento set cobro_por = 'cuadrante'
 where cobro_por = 'pieza' and nombre ilike '%por cuadrante%';

-- Versiones y alternativas: la copia conserva la zona.
create or replace function public.copiar_plan(id_plan uuid, como text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_tratamiento;
  v_nuevo uuid := gen_random_uuid();
  v_version smallint;
  v_alternativa char(1);
begin
  if not privado.es_dentista() then
    raise exception 'Solo un cirujano dentista crea versiones o alternativas del plan';
  end if;
  if como not in ('version', 'alternativa') then
    raise exception 'Indica si es una versión o una alternativa';
  end if;
  select * into v_plan from public.plan_tratamiento where id = id_plan and clinica_id = privado.clinica_actual();
  if v_plan.id is null then
    raise exception 'Plan no encontrado';
  end if;
  if como = 'alternativa' and v_plan.estado <> 'propuesto' then
    raise exception 'Las alternativas se presentan junto a un plan propuesto; para cambiar uno aceptado, crea una versión';
  end if;
  if v_plan.estado not in ('propuesto', 'aceptado', 'en_curso', 'detenido') then
    raise exception 'Este plan ya no se puede copiar';
  end if;
  if exists (select 1 from public.paciente where id = v_plan.paciente_id and anulado_at is not null) then
    raise exception 'El paciente está anulado: registra el plan en el paciente vigente';
  end if;
  -- Bloquea el grupo para numerar sin choques.
  perform 1 from public.plan_tratamiento
   where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id and paciente_id = v_plan.paciente_id for update;
  if como = 'version' then
    v_version := (select max(version) + 1 from public.plan_tratamiento
                   where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id);
    v_alternativa := v_plan.alternativa;
  else
    v_version := v_plan.version;
    v_alternativa := chr(ascii((select max(alternativa) from public.plan_tratamiento
                                 where grupo_id = v_plan.grupo_id and clinica_id = v_plan.clinica_id
                                   and version = v_plan.version)) + 1);
    if v_alternativa > 'Z' then
      raise exception 'No caben más alternativas';
    end if;
  end if;

  insert into public.plan_tratamiento (id, clinica_id, paciente_id, odontologo_id, titulo, plan_origen_id, grupo_id,
                                       version, alternativa, estado, fecha_vencimiento)
  values (v_nuevo, v_plan.clinica_id, v_plan.paciente_id, auth.uid(), v_plan.titulo, v_plan.id, v_plan.grupo_id,
          v_version, v_alternativa, 'propuesto', (now() at time zone 'America/Lima')::date + 30);
  insert into public.plan_fase (clinica_id, plan_id, numero, nombre)
  select clinica_id, v_nuevo, numero, nombre from public.plan_fase where plan_id = v_plan.id;

  -- Ítems pendientes (lo realizado o cancelado queda en el plan anterior). Cada copia
  -- recuerda su ítem de origen (para el consentimiento ya firmado).
  create temp table copia_item on commit drop as
  select i.id as viejo, gen_random_uuid() as nuevo from public.item_plan i
   where i.plan_id = v_plan.id and i.estado in ('propuesto', 'aceptado', 'programado');
  insert into public.item_plan (id, clinica_id, plan_id, pieza, superficies, zona, procedimiento, procedimiento_id, cie10,
                                diagnostico_id, precio_centimos, duracion_minutos, odontologo_id, estado, orden, fase,
                                item_origen_id)
  select c.nuevo, i.clinica_id, v_nuevo, i.pieza, i.superficies, i.zona, i.procedimiento, i.procedimiento_id, i.cie10,
         (select d.id from public.diagnostico d where d.id = i.diagnostico_id and d.anulado_at is null),
         i.precio_centimos, i.duracion_minutos, i.odontologo_id, 'propuesto', i.orden, i.fase, i.id
    from public.item_plan i join copia_item c on c.viejo = i.id;
  insert into public.item_dependencia (clinica_id, item_id, requiere_id)
  select v_plan.clinica_id, a.nuevo, b.nuevo
    from public.item_dependencia d join copia_item a on a.viejo = d.item_id join copia_item b on b.viejo = d.requiere_id;
  drop table copia_item;
  return v_nuevo;
end $$;

-- ---------------------------------------------------------------------------
-- La zona es parte de lo que el paciente aceptó y firmó: como el procedimiento y la pieza, no
-- cambia en un ítem aceptado o con consentimiento, y el consentimiento de la versión anterior
-- solo vale para la misma zona.
-- ---------------------------------------------------------------------------
create or replace function privado.congelar_procedimiento_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not privado.en_fusion()
     and new.item_origen_id is distinct from old.item_origen_id then
    raise exception 'El ítem de origen lo fija la copia del plan y no cambia';
  end if;
  if auth.uid() is not null and not privado.en_fusion()
     and (new.procedimiento_id is distinct from old.procedimiento_id or new.pieza is distinct from old.pieza
          or new.zona is distinct from old.zona)
     and (old.estado <> 'propuesto'
          or exists (select 1 from public.consentimiento c where c.item_plan_id = old.id and c.anulado_at is null)) then
    raise exception 'El procedimiento, la pieza y la zona de un ítem aceptado o con consentimiento no cambian: haz una versión nueva del plan';
  end if;
  return new;
end $$;

create or replace function privado.tiene_consentimiento(id_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with recursive cadena as (
    select i.id, i.item_origen_id, i.procedimiento_id, i.pieza, i.zona from public.item_plan i where i.id = id_item
    union  -- (sin repetidos: una cadena circular no puede repetirse sin fin)
    select o.id, o.item_origen_id, o.procedimiento_id, o.pieza, o.zona
      from public.item_plan o join cadena c on o.id = c.item_origen_id
     where o.procedimiento_id is not distinct from c.procedimiento_id and o.pieza is not distinct from c.pieza
       and o.zona is not distinct from c.zona
  )
  select exists (select 1 from public.consentimiento k join cadena c on c.id = k.item_plan_id
                  where k.estado = 'firmado' and k.anulado_at is null)
$$;

-- ---------------------------------------------------------------------------
-- Clínicas de prueba nuevas: el catálogo copiado de la demo conserva cómo se cotiza cada
-- procedimiento (el resto, igual que en 0929).
-- ---------------------------------------------------------------------------
create or replace function public.crear_clinica_prueba(nombre_clinica text, nombre_usuario text, cop text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_yo uuid := auth.uid();
  v_demo uuid := 'c0000000-0000-4000-8000-000000000001';
  v_clinica uuid;
  v_sillon uuid;
  v_paciente uuid;
  p record;
  v_mapa jsonb := '{}';
  v_nueva uuid;
begin
  if v_yo is null then
    raise exception 'Inicia sesión para crear tu clínica';
  end if;
  if exists (select 1 from public.usuario where id = v_yo) then
    raise exception 'Tu usuario ya pertenece a una clínica';
  end if;
  if privado.es_superadmin() then
    raise exception 'El superadministrador no crea clínicas de prueba';
  end if;
  if char_length(btrim(coalesce(nombre_clinica, ''))) not between 3 and 120 then
    raise exception 'El nombre de la clínica va de 3 a 120 caracteres';
  end if;
  if char_length(btrim(coalesce(nombre_usuario, ''))) not between 3 and 120 then
    raise exception 'Tu nombre va de 3 a 120 caracteres';
  end if;
  if nullif(btrim(coalesce(cop, '')), '') is not null and btrim(cop) !~ '^\d{1,6}$' then
    raise exception 'El número de colegiatura (COP) tiene de 1 a 6 dígitos';
  end if;

  insert into public.clinica (nombre, plan, prueba_hasta)
  -- 30 días contando hoy: escribe hasta prueba_hasta inclusive.
  values (btrim(nombre_clinica), 'prueba', (now() at time zone 'America/Lima')::date + 29)
  returning id into v_clinica;
  insert into public.usuario (id, clinica_id, nombre, rol, cop)
  values (v_yo, v_clinica, btrim(nombre_usuario), 'admin', nullif(btrim(coalesce(cop, '')), ''));

  -- Catálogo y plantillas de ejemplo (de la clínica de demostración, si existe).
  for p in select * from public.plantilla_consentimiento where clinica_id = v_demo and activa loop
    insert into public.plantilla_consentimiento (clinica_id, tipo, nombre, descripcion, riesgos, efectos_adversos, pronostico, es_ejemplo)
    values (v_clinica, p.tipo, p.nombre, p.descripcion, p.riesgos, p.efectos_adversos, p.pronostico, true)
    returning id into v_nueva;
    v_mapa := v_mapa || jsonb_build_object(p.id::text, v_nueva);
  end loop;
  insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos,
                                    requiere_consentimiento, control_dias, consentimiento_plantilla_id, cobro_por)
  select v_clinica, codigo, nombre, especialidad, precio_base_centimos, duracion_minutos, requiere_consentimiento, control_dias,
         (v_mapa ->> consentimiento_plantilla_id::text)::uuid, cobro_por
    from public.procedimiento where clinica_id = v_demo and activo;
  insert into public.plantilla_mensaje (clinica_id, tipo, nombre, cuerpo)
  select v_clinica, tipo, nombre, cuerpo from public.plantilla_mensaje where clinica_id = v_demo and activa;

  -- Un sillón y, si es cirujano dentista (con COP), su horario de lunes a sábado de 9:00 a 19:00
  -- (editables). Sin COP no atiende: no lleva horario.
  insert into public.sillon (clinica_id, nombre) values (v_clinica, 'Sillón 1') returning id into v_sillon;
  if nullif(btrim(coalesce(cop, '')), '') is not null then
    insert into public.horario_profesional (clinica_id, profesional_id, sillon_id, dia_semana, hora_inicio, hora_fin)
    select v_clinica, v_yo, v_sillon, d, '09:00', '19:00' from generate_series(1, 6) d;
  end if;

  -- Pacientes de ejemplo: ficticios y así rotulados (sin documento, para no usar un DNI real).
  insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, sexo, telefono, consentimiento_datos_at)
  values (v_clinica, 'Ana (ejemplo)', 'Paciente Ficticia', '1990-04-12', 'femenino', '51900000001', now())
  returning id into v_paciente;
  insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, tiempo_enfermedad, alergias,
                                         embarazo, observaciones)
  values (v_clinica, v_paciente, v_yo, 'Dolor al masticar en molar inferior derecho', '2 semanas', array['Penicilina'], 'no',
          'Paciente de ejemplo (ficticio)');
  insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, sexo, telefono, consentimiento_datos_at)
  values (v_clinica, 'Jorge (ejemplo)', 'Paciente Ficticio', '1968-09-30', 'masculino', '51900000002', now())
  returning id into v_paciente;
  insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, motivo_consulta, enfermedades, anticoagulado,
                                         anticoagulante, observaciones)
  values (v_clinica, v_paciente, v_yo, 'Control y limpieza', array['hipertension', 'cardiopatia'], true, 'Warfarina 5 mg diaria',
          'Paciente de ejemplo (ficticio)');
  insert into public.paciente (clinica_id, nombres, apellidos, fecha_nacimiento, sexo, telefono, consentimiento_datos_at,
                               apoderado_nombre, apoderado_parentesco, apoderado_telefono, apoderado_dni)
  values (v_clinica, 'Sofía (ejemplo)', 'Paciente Ficticia', ((now() at time zone 'America/Lima')::date - interval '8 years')::date,
          -- DNI 00000000: imposible en la realidad, para no usar el de una persona.
          'femenino', '51900000003', now(), 'Apoderada de ejemplo', 'madre', '51900000004', '00000000');

  return v_clinica;
end $$;
revoke all on function public.crear_clinica_prueba(text, text, text) from public, anon;
grant execute on function public.crear_clinica_prueba(text, text, text) to authenticated;
