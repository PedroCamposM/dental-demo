-- Etapa 14 (v2): atención rápida (paciente ocasional, una sola sesión).
--
-- Junta en un solo paso lo mínimo que la NTS 139 pide en la primera atención de consulta
-- externa (formato del adulto, 5.2.1 g, y ficha odonto-estomatológica 12.2): motivo de
-- consulta y tiempo de enfermedad, antecedentes y alergias, examen, diagnóstico CIE-10,
-- tratamiento efectuado y firma del profesional. No crea un registro aparte: deja lo mismo
-- que el flujo completo (cuestionario versionado, examen, diagnóstico, plan aceptado,
-- evolución firmada y, con ella, los ítems realizados y sus controles).
--
-- SECURITY INVOKER: corre con los permisos de quien atiende, así que RLS, grants y todos los
-- triggers (regla 3 incluida: si un procedimiento requiere consentimiento firmado, no se
-- firma) aplican igual que en el flujo completo. Todo en una transacción: o queda la
-- atención completa o no queda nada.

create function public.registrar_atencion_rapida(id_paciente uuid, datos jsonb)
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
  h jsonb := coalesce(datos -> 'historia', '{}'::jsonb);
  e jsonb := coalesce(datos -> 'evolucion', '{}'::jsonb);
  d jsonb := datos -> 'diagnostico';
  it jsonb;
begin
  if not privado.es_dentista() then
    raise exception 'Solo el cirujano dentista registra la atención';
  end if;
  if not exists (select 1 from public.paciente where id = id_paciente and clinica_id = v_clinica and anulado_at is null) then
    raise exception 'Paciente no encontrado';
  end if;
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
    coalesce(array(select jsonb_array_elements_text(h -> 'enfermedades')), v_previo.enfermedades, '{}'),
    v_previo.enfermedades_otras, v_previo.cirugias, v_previo.hospitalizaciones, v_previo.antecedentes_familiares,
    nullif(btrim(coalesce(h ->> 'medicacion', '')), ''),
    coalesce((h ->> 'anticoagulado')::boolean, false), nullif(btrim(coalesce(h ->> 'anticoagulante', '')), ''),
    coalesce(array(select jsonb_array_elements_text(h -> 'alergias')), '{}'),
    coalesce(nullif(h ->> 'embarazo', ''), 'no_aplica'),
    case when h ->> 'embarazo' = 'si' then v_previo.semanas_gestacion end, coalesce(v_previo.lactancia, false),
    coalesce(v_previo.habitos, '{}'), v_previo.habitos_otros, v_previo.antecedentes_odontologicos,
    'Registrado en atención rápida');

  -- 2. Examen (lo encontrado; los campos estructurados quedan para el examen completo).
  insert into public.examen_clinico (clinica_id, paciente_id, registrado_por, observaciones, higiene)
  values (v_clinica, id_paciente, v_yo, btrim(datos #>> '{examen,observaciones}'), nullif(datos #>> '{examen,higiene}', ''))
  returning id into v_examen;

  -- 3. Diagnóstico CIE-10, ligado al examen.
  insert into public.diagnostico (clinica_id, paciente_id, registrado_por, cie10, tipo, pieza, examen_id)
  values (v_clinica, id_paciente, v_yo, upper(btrim(d ->> 'cie10')), coalesce(nullif(d ->> 'tipo', ''), 'definitivo'),
          nullif(d ->> 'pieza', '')::smallint, v_examen)
  returning id into v_dx;

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
    insert into public.item_plan (clinica_id, plan_id, odontologo_id, procedimiento_id, procedimiento, precio_centimos,
                                  duracion_minutos, pieza, fase, orden, diagnostico_id)
    values (v_clinica, v_plan, v_yo, v_proc.id, v_proc.nombre, v_proc.precio_base_centimos, v_proc.duracion_minutos,
            nullif(it ->> 'pieza', '')::smallint, 1, v_n, v_dx)
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
revoke all on function public.registrar_atencion_rapida(uuid, jsonb) from public, anon;
grant execute on function public.registrar_atencion_rapida(uuid, jsonb) to authenticated;
