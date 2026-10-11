-- Etapa 14, correcciones de la revisión independiente: registrar_atencion_rapida.
--
-- - Las enfermedades sistémicas y las observaciones de la versión vigente del cuestionario
--   se conservan (antes la versión nueva quedaba sin enfermedades y se perdía la alerta).
-- - Embarazo: obligatorio para quien puede gestar (se valida aquí con el sexo y la edad);
--   «no aplica» para los demás. Semanas y lactancia se preguntan en la atención: ya no se
--   copian de la versión anterior.
-- - El diagnóstico es origen solo de los ítems de su misma pieza.
-- Misma firma, mismos permisos (create or replace conserva los grants).

create or replace function public.registrar_atencion_rapida(id_paciente uuid, datos jsonb)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_clinica uuid := privado.clinica_actual();
  v_yo uuid := auth.uid();
  v_previo public.cuestionario_salud;
  v_examen uuid;
  v_dx uuid;
  v_plan uuid;
  v_nota uuid;
  v_item uuid;
  v_items uuid[] := '{}';
  v_proc record;
  v_n int := 0;
  v_pac record;
  v_gesta boolean;
  v_embarazo text;
  v_semanas smallint;
  v_pieza_dx smallint;
  v_pieza smallint;
  h jsonb := coalesce(datos -> 'historia', '{}'::jsonb);
  e jsonb := coalesce(datos -> 'evolucion', '{}'::jsonb);
  d jsonb := datos -> 'diagnostico';
  it jsonb;
begin
  if not privado.es_dentista() then
    raise exception 'Solo el cirujano dentista registra la atención';
  end if;
  select sexo, fecha_nacimiento into v_pac from public.paciente
   where id = id_paciente and clinica_id = v_clinica and anulado_at is null;
  if not found then
    raise exception 'Paciente no encontrado';
  end if;
  -- Embarazo: se pregunta siempre a quien puede gestar (no masculino y 12 años o más; sin
  -- dato, se pregunta igual). A los demás, «no aplica».
  v_gesta := v_pac.sexo is distinct from 'masculino'
             and (v_pac.fecha_nacimiento is null or v_pac.fecha_nacimiento <= (now() at time zone 'America/Lima')::date - interval '12 years');
  v_embarazo := coalesce(nullif(h ->> 'embarazo', ''), '');
  if v_gesta and v_embarazo not in ('no', 'si', 'no_sabe') then
    raise exception 'Pregunta si está embarazada';
  end if;
  if not v_gesta then
    v_embarazo := 'no_aplica';
  end if;
  v_semanas := case when v_embarazo = 'si' then nullif(h ->> 'semanas_gestacion', '')::smallint end;
  if char_length(btrim(coalesce(h ->> 'motivo_consulta', ''))) < 3 then
    raise exception 'Escribe el motivo de consulta';
  end if;
  if coalesce((h ->> 'alergias_preguntadas')::boolean, false) is not true then
    raise exception 'Pregunta por las alergias (registra «ninguna» si no tiene)';
  end if;
  if char_length(btrim(coalesce(datos #>> '{examen,observaciones}', ''))) < 3 then
    raise exception 'Registra el examen (lo encontrado al examinar)';
  end if;
  if d is null or coalesce(d ->> 'cie10', '') = '' then
    raise exception 'Indica el diagnóstico CIE-10';
  end if;
  if jsonb_typeof(datos -> 'items') is distinct from 'array' or jsonb_array_length(datos -> 'items') = 0 then
    raise exception 'Indica el tratamiento realizado (al menos un procedimiento)';
  end if;
  if jsonb_array_length(datos -> 'items') > 32 then
    raise exception 'Máximo 32 procedimientos por atención';
  end if;
  if char_length(btrim(coalesce(e ->> 'texto', ''))) < 3 then
    raise exception 'Escribe la descripción de lo realizado';
  end if;

  -- 1. Cuestionario de salud: versión nueva. Lo propio de esta consulta viene del formulario;
  --    los antecedentes que no se preguntan en la atención rápida se copian de la versión vigente.
  select * into v_previo from public.cuestionario_salud where paciente_id = id_paciente order by version desc limit 1;
  insert into public.cuestionario_salud (
    clinica_id, paciente_id, registrado_por, motivo_consulta, tiempo_enfermedad, enfermedades, enfermedades_otras,
    cirugias, hospitalizaciones, antecedentes_familiares, medicacion, anticoagulado, anticoagulante, alergias, embarazo,
    semanas_gestacion, lactancia, habitos, habitos_otros, antecedentes_odontologicos, observaciones)
  values (
    v_clinica, id_paciente, v_yo, btrim(h ->> 'motivo_consulta'), nullif(btrim(coalesce(h ->> 'tiempo_enfermedad', '')), ''),
    -- Lo que la atención rápida no pregunta se conserva de la versión vigente (no se pierden alertas).
    case when h ? 'enfermedades' then array(select jsonb_array_elements_text(h -> 'enfermedades'))
         else coalesce(v_previo.enfermedades, '{}') end,
    v_previo.enfermedades_otras, v_previo.cirugias, v_previo.hospitalizaciones, v_previo.antecedentes_familiares,
    nullif(btrim(coalesce(h ->> 'medicacion', '')), ''),
    coalesce((h ->> 'anticoagulado')::boolean, false), nullif(btrim(coalesce(h ->> 'anticoagulante', '')), ''),
    coalesce(array(select jsonb_array_elements_text(h -> 'alergias')), '{}'),
    -- Embarazo, semanas y lactancia se preguntan hoy: nunca se copian (cambian con el tiempo).
    v_embarazo, v_semanas, v_gesta and coalesce((h ->> 'lactancia')::boolean, false),
    coalesce(v_previo.habitos, '{}'), v_previo.habitos_otros, v_previo.antecedentes_odontologicos,
    concat_ws(E'\n', v_previo.observaciones, 'Registrado en atención rápida'));

  -- 2. Examen (lo encontrado; los campos estructurados quedan para el examen completo).
  insert into public.examen_clinico (clinica_id, paciente_id, registrado_por, observaciones, higiene)
  values (v_clinica, id_paciente, v_yo, btrim(datos #>> '{examen,observaciones}'), nullif(datos #>> '{examen,higiene}', ''))
  returning id into v_examen;

  -- 3. Diagnóstico CIE-10, ligado al examen.
  insert into public.diagnostico (clinica_id, paciente_id, registrado_por, cie10, tipo, pieza, examen_id)
  values (v_clinica, id_paciente, v_yo, upper(btrim(d ->> 'cie10')), coalesce(nullif(d ->> 'tipo', ''), 'definitivo'),
          nullif(d ->> 'pieza', '')::smallint, v_examen)
  returning id, pieza into v_dx, v_pieza_dx;

  -- 4. Plan de una sola sesión, aceptado por el paciente.
  insert into public.plan_tratamiento (clinica_id, paciente_id, odontologo_id, titulo)
  values (v_clinica, id_paciente, v_yo, 'Atención rápida del ' || to_char((now() at time zone 'America/Lima')::date, 'DD/MM/YYYY'))
  returning id into v_plan;
  insert into public.plan_fase (clinica_id, plan_id, numero, nombre) values (v_clinica, v_plan, 1, 'Atención');
  for it in select * from jsonb_array_elements(datos -> 'items') loop
    select id, nombre, precio_base_centimos, duracion_minutos into v_proc
      from public.procedimiento where id = (it ->> 'procedimiento_id')::uuid and clinica_id = v_clinica and activo;
    if v_proc.id is null then
      raise exception 'Procedimiento no encontrado en el catálogo';
    end if;
    v_n := v_n + 1;
    v_pieza := nullif(it ->> 'pieza', '')::smallint;
    -- El diagnóstico es origen del ítem solo si es de la misma pieza (o alguno no tiene pieza).
    insert into public.item_plan (clinica_id, plan_id, odontologo_id, procedimiento_id, procedimiento, precio_centimos,
                                  duracion_minutos, pieza, fase, orden, diagnostico_id)
    values (v_clinica, v_plan, v_yo, v_proc.id, v_proc.nombre, v_proc.precio_base_centimos, v_proc.duracion_minutos,
            v_pieza, 1, v_n, case when v_pieza_dx is null or v_pieza is null or v_pieza = v_pieza_dx then v_dx end)
    returning id into v_item;
    v_items := v_items || v_item;
  end loop;
  perform public.aceptar_plan(v_plan, null);

  -- 5. Evolución de la sesión: lo realizado, firmada (los ítems quedan realizados y se
  --    programan sus controles, como en el flujo completo).
  insert into public.nota_evolucion (clinica_id, paciente_id, odontologo_id, texto, cie10, anestesia_tipo, anestesia_cantidad,
                                     indicaciones, proxima_cita)
  values (v_clinica, id_paciente, v_yo, btrim(e ->> 'texto'), upper(btrim(d ->> 'cie10')),
          nullif(btrim(coalesce(e ->> 'anestesia_tipo', '')), ''), nullif(btrim(coalesce(e ->> 'anestesia_cantidad', '')), ''),
          nullif(btrim(coalesce(e ->> 'indicaciones', '')), ''), nullif(btrim(coalesce(e ->> 'proxima_cita', '')), ''))
  returning id into v_nota;
  insert into public.evolucion_item (clinica_id, nota_id, item_id, trabajado, terminado)
  select v_clinica, v_nota, x, true, true from unnest(v_items) x;
  perform public.firmar_evolucion(v_nota);

  return jsonb_build_object('plan_id', v_plan, 'nota_id', v_nota, 'diagnostico_id', v_dx);
end $$;
