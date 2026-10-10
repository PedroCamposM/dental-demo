-- Etapa 12 (v2): refrescar las fechas de la demo.
--
-- Los datos de la demo se escribieron con fechas relativas al día en que se cargaron; con
-- los días «envejecen» (citas de hoy que quedan en el pasado, cuotas que vencen de más,
-- controles que dejan de estar por venir). refrescar_fechas_demo() corre TODAS las fechas
-- de una clínica de demostración tantos días como pasaron desde la última vez, así la
-- demo se ve siempre como el día en que se cargó (mismas citas de hoy, mismos atrasos).
--
-- Seguridad:
-- - Solo actúa sobre una clínica registrada en privado.clinica_demo (la de demostración);
--   nunca sobre una clínica real. Solo la ejecuta el rol de servicio (no la app).
-- - No toca la auditoría ni las exportaciones (son hechos reales, con su hora real).
-- - Corre todas las fechas el mismo número de días: se conservan el orden y las
--   distancias entre ellas (y lo que las reglas exigen de ellas). Las reglas que miran la
--   hora actual se apagan mientras se corre (triggers de usuario de cada tabla).

create table privado.clinica_demo (
  clinica_id  uuid primary key references public.clinica (id),
  referencia  date not null   -- el día al que corresponden las fechas guardadas
);

-- La clínica de la demo, si ya existe (remoto). En local/CI la registra seed_etapa12.sql.
insert into privado.clinica_demo (clinica_id, referencia)
select id, (now() at time zone 'America/Lima')::date from public.clinica where id = 'c0000000-0000-4000-8000-000000000001'
on conflict do nothing;

create function privado.refrescar_fechas_demo(id_clinica uuid) returns jsonb
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
  v_dias := (now() at time zone 'America/Lima')::date - v_ref;
  if v_dias = 0 then
    return jsonb_build_object('dias', 0, 'tablas', 0, 'filas', 0);
  end if;
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
