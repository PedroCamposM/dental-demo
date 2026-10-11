-- Etapa 12, correcciones de la revisión independiente: refrescar fechas de la demo.
--
-- - Corre semanas completas (múltiplo de 7 días): antes, correr p. ej. 3 días dejaba citas en
--   días en que el profesional no atiende y feriados en fechas que no lo son.
-- - lock_timeout de 5 s: si una tabla está ocupada, falla en vez de detener a las demás clínicas
--   (todo se revierte; ningún trigger queda apagado).

create or replace function privado.refrescar_fechas_demo(id_clinica uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ref date;
  v_dias int;
  v_lejos constant int := 36500;   -- dos pasos (ida y vuelta) para no chocar en índices únicos con fechas
  t record;
  v_set text;
  n bigint;
  v_filas bigint := 0;
  v_tablas int := 0;
begin
  select referencia into v_ref from privado.clinica_demo where clinica_id = id_clinica for update;
  if v_ref is null then
    raise exception 'Solo se refrescan las fechas de una clínica de demostración';
  end if;
  -- Semanas completas: así cada cita cae el mismo día de la semana (los horarios de los
  -- profesionales y los bloqueos siguen valiendo). Lo que sobra se corre la próxima vez.
  v_dias := (now() at time zone 'America/Lima')::date - v_ref;
  v_dias := v_dias - mod(v_dias, 7);
  if v_dias = 0 then
    return jsonb_build_object('dias', 0, 'tablas', 0, 'filas', 0);
  end if;
  -- No esperar bloqueos largos: desactivar triggers toma un bloqueo exclusivo de cada tabla.
  perform set_config('lock_timeout', '5s', true);
  for t in
    select c.oid, c.relname
      from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname = 'public' and c.relkind = 'r'
       and c.relname not in ('auditoria', 'exportacion_historia')
       and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'clinica_id' and not a.attisdropped)
     order by c.relname
  loop
    select string_agg(format('%I = %I + %s', a.attname, a.attname,
                             case when a.atttypid = 'date'::regtype then '$1' else 'make_interval(days => $1)' end), ', ')
      into v_set
      from pg_attribute a
     where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
       and a.atttypid in ('date'::regtype, 'timestamptz'::regtype, 'timestamp'::regtype);
    continue when v_set is null;
    execute format('alter table public.%I disable trigger user', t.relname);
    execute format('update public.%I set %s where clinica_id = $2', t.relname, v_set) using v_lejos, id_clinica;
    execute format('update public.%I set %s where clinica_id = $2', t.relname, v_set) using v_dias - v_lejos, id_clinica;
    get diagnostics n = row_count;
    execute format('alter table public.%I enable trigger user', t.relname);
    v_filas := v_filas + n;
    v_tablas := v_tablas + 1;
  end loop;
  update privado.clinica_demo set referencia = referencia + v_dias where clinica_id = id_clinica;
  return jsonb_build_object('dias', v_dias, 'tablas', v_tablas, 'filas', v_filas);
end $$;
revoke all on function privado.refrescar_fechas_demo(uuid) from public, anon, authenticated;
