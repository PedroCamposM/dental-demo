-- Etapa 9 (v2), rebanada 1: periodontograma.
--
-- Aditiva:
-- - periodontograma: un examen periodontal por fecha (borrador → firmado por el cirujano
--   dentista responsable). Firmado no se edita (regla 2); se anula con motivo (regla 1).
-- - periodonto_pieza: por pieza permanente, movilidad y furca; por sitio (6 por pieza:
--   mesiovestibular, vestibular, distovestibular, mesiopalatino/lingual, palatino/lingual,
--   distopalatino/lingual), profundidad de sondaje (PS), margen gingival (MG), sangrado,
--   supuración y placa. Nivel de inserción clínica calculado: NIC = PS + MG, con MG
--   positivo cuando el margen está apical al límite amelocementario (recesión) y negativo
--   cuando está coronal. Movilidad y furca se registran como grado 0 a 3, sin fijar una
--   clasificación (la clínica indica cuál usa).
-- - Al firmarlo, si se indica, se programa el mantenimiento periodontal (seguimiento).
-- Lo registran el cirujano dentista y la asistente (que anota lo que se le dicta); solo el
-- cirujano dentista responsable lo firma. Recepción no lo ve.

create table public.periodontograma (
  id                  uuid primary key default gen_random_uuid(),
  clinica_id          uuid not null,
  paciente_id         uuid not null,
  odontologo_id       uuid not null,   -- responsable: quien lo firma
  registrado_por      uuid not null default auth.uid(),
  fecha               timestamptz not null default now(),
  nota_id             uuid,            -- sesión (evolución) en que se tomó, si la hay
  observaciones       text check (char_length(observaciones) <= 2000),
  mantenimiento_meses smallint check (mantenimiento_meses between 1 and 24),
  firmado_at          timestamptz,
  anulado_at          timestamptz,
  anulado_por         uuid,
  motivo_anulacion    text check (char_length(btrim(motivo_anulacion)) between 5 and 300),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (clinica_id, id),
  foreign key (clinica_id, paciente_id) references public.paciente (clinica_id, id),
  foreign key (clinica_id, odontologo_id) references public.usuario (clinica_id, id),
  foreign key (clinica_id, registrado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, anulado_por) references public.usuario (clinica_id, id),
  foreign key (clinica_id, nota_id) references public.nota_evolucion (clinica_id, id),
  constraint periodontograma_anulacion check ((anulado_at is null) = (motivo_anulacion is null)
                                              and (anulado_at is null) = (anulado_por is null))
);
alter table public.periodontograma enable row level security;
create index periodontograma_paciente_idx on public.periodontograma (paciente_id, fecha desc);

create table public.periodonto_pieza (
  id                 uuid primary key default gen_random_uuid(),
  clinica_id         uuid not null,
  periodontograma_id uuid not null,
  -- Dentición permanente (FDI 11–48).
  pieza              smallint not null check (pieza / 10 between 1 and 4 and pieza % 10 between 1 and 8),
  ausente            boolean not null default false,
  implante           boolean not null default false,
  movilidad          smallint check (movilidad between 0 and 3),
  furca              smallint check (furca between 0 and 3),
  -- Seis sitios en orden: MV, V, DV, MP/ML, P/L, DP/DL (null: no medido).
  ps                 smallint[] not null default '{null,null,null,null,null,null}'
                     check (cardinality(ps) = 6 and 0 <= all (ps) and 20 >= all (ps)),
  mg                 smallint[] not null default '{null,null,null,null,null,null}'
                     check (cardinality(mg) = 6 and -10 <= all (mg) and 20 >= all (mg)),
  sangrado           boolean[] not null default '{f,f,f,f,f,f}' check (cardinality(sangrado) = 6),
  supuracion         boolean[] not null default '{f,f,f,f,f,f}' check (cardinality(supuracion) = 6),
  placa              boolean[] not null default '{f,f,f,f,f,f}' check (cardinality(placa) = 6),
  updated_at         timestamptz not null default now(),
  unique (periodontograma_id, pieza),
  foreign key (clinica_id, periodontograma_id) references public.periodontograma (clinica_id, id),
  constraint pieza_ausente_sin_datos check (not ausente or (movilidad is null and furca is null
    and ps = '{null,null,null,null,null,null}' and mg = '{null,null,null,null,null,null}'))
);
alter table public.periodonto_pieza enable row level security;

-- ---------------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------------
create function privado.preparar_periodontograma() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    new.registrado_por := auth.uid();
    new.fecha := now();
    new.firmado_at := null;
    new.anulado_at := null;
    new.anulado_por := null;
    new.motivo_anulacion := null;
    -- El cirujano dentista lo toma a su nombre; la asistente indica el responsable.
    if privado.es_dentista() then
      new.odontologo_id := auth.uid();
    end if;
  end if;
  if not exists (select 1 from public.usuario u where u.id = new.odontologo_id and u.clinica_id = new.clinica_id
                   and u.activo and u.rol in ('admin', 'odontologo') and u.cop is not null) then
    raise exception 'El responsable del periodontograma debe ser un cirujano dentista activo';
  end if;
  if new.nota_id is not null and not exists (select 1 from public.nota_evolucion n
       where n.id = new.nota_id and n.paciente_id = new.paciente_id and n.clinica_id = new.clinica_id) then
    raise exception 'La evolución no corresponde a este paciente';
  end if;
  return new;
end $$;
create trigger preparar before insert on public.periodontograma
  for each row execute function privado.preparar_periodontograma();
create trigger paciente_vigente before insert on public.periodontograma
  for each row execute function privado.validar_paciente_vigente();

-- Borrador: se editan las observaciones y el mantenimiento. Firmado: solo se anula, con
-- motivo y a nombre propio, sin tocar el contenido. La firma la pone firmar_periodontograma().
create function privado.proteger_periodontograma() returns trigger
language plpgsql set search_path = '' as $$
begin
  if privado.en_fusion() and (to_jsonb(new) - 'paciente_id') = (to_jsonb(old) - 'paciente_id') then
    return new;
  end if;
  if old.anulado_at is not null then
    raise exception 'El periodontograma está anulado y no se modifica';
  end if;
  if new.clinica_id is distinct from old.clinica_id or new.paciente_id is distinct from old.paciente_id
     or new.odontologo_id is distinct from old.odontologo_id or new.registrado_por is distinct from old.registrado_por
     or new.fecha is distinct from old.fecha or new.nota_id is distinct from old.nota_id
     or new.created_at is distinct from old.created_at then
    raise exception 'El paciente, el responsable, la fecha y la sesión del periodontograma no cambian';
  end if;
  if new.anulado_at is not null then
    if current_user = 'authenticated' and new.anulado_por is distinct from auth.uid() then
      raise exception 'Solo se anula a nombre propio, con motivo';
    end if;
    if (to_jsonb(new) - array['anulado_at', 'anulado_por', 'motivo_anulacion', 'updated_at'])
       is distinct from (to_jsonb(old) - array['anulado_at', 'anulado_por', 'motivo_anulacion', 'updated_at']) then
      raise exception 'Al anular un periodontograma no se modifica su contenido';
    end if;
    new.anulado_at := now();
    new.updated_at := now();
    return new;
  end if;
  if old.firmado_at is not null then
    raise exception 'Un periodontograma firmado no se edita: toma uno nuevo';
  end if;
  if new.firmado_at is not null and not privado.en_proceso() then
    raise exception 'El periodontograma se firma con «Firmar»';
  end if;
  if current_user = 'authenticated' and auth.uid() is distinct from old.odontologo_id
     and auth.uid() is distinct from old.registrado_por then
    raise exception 'El borrador lo completan su responsable o quien lo registró';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger proteger before update on public.periodontograma
  for each row execute function privado.proteger_periodontograma();

-- Las piezas solo se registran o cambian mientras el periodontograma está en borrador.
create function privado.validar_periodonto_pieza() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.periodontograma_id is distinct from old.periodontograma_id
                           or new.pieza is distinct from old.pieza or new.clinica_id is distinct from old.clinica_id) then
    raise exception 'La pieza y el periodontograma no cambian';
  end if;
  if not exists (select 1 from public.periodontograma p where p.id = new.periodontograma_id
                   and p.clinica_id = new.clinica_id and p.firmado_at is null and p.anulado_at is null) then
    raise exception 'Solo se registra en un periodontograma en borrador';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger validar before insert or update on public.periodonto_pieza
  for each row execute function privado.validar_periodonto_pieza();

create trigger auditar after insert or update on public.periodontograma
  for each row execute function privado.auditar_simple();

-- ---------------------------------------------------------------------------
-- Guardar las piezas (una sola operación) y firmar
-- ---------------------------------------------------------------------------
-- Seis valores por pieza desde JSON (null si falta; error si no son seis).
create function privado.seis_numeros(j jsonb, pieza smallint, que text) returns smallint[]
language plpgsql immutable set search_path = '' as $$
declare
  v smallint[];
begin
  if j is null or jsonb_typeof(j) = 'null' then
    return '{null,null,null,null,null,null}';
  end if;
  if jsonb_typeof(j) <> 'array' or jsonb_array_length(j) <> 6 then
    raise exception 'Pieza %: % debe tener seis sitios', pieza, que;
  end if;
  if exists (select 1 from jsonb_array_elements(j) x
              where jsonb_typeof(x) not in ('number', 'null') or (jsonb_typeof(x) = 'number' and (x #>> '{}')::numeric % 1 <> 0)) then
    raise exception 'Pieza %: % en milímetros enteros', pieza, que;
  end if;
  select array_agg(case when jsonb_typeof(x) = 'number' then (x #>> '{}')::numeric::smallint end order by n)
    into v from jsonb_array_elements(j) with ordinality as t(x, n);
  return v;
exception when numeric_value_out_of_range or invalid_text_representation then
  raise exception 'Pieza %: % con valores inválidos', pieza, que;
end $$;
create function privado.seis_marcas(j jsonb, pieza smallint, que text) returns boolean[]
language plpgsql immutable set search_path = '' as $$
declare
  v boolean[];
begin
  if j is null or jsonb_typeof(j) = 'null' then
    return '{f,f,f,f,f,f}';
  end if;
  if jsonb_typeof(j) <> 'array' or jsonb_array_length(j) <> 6 then
    raise exception 'Pieza %: % debe tener seis sitios', pieza, que;
  end if;
  select array_agg(coalesce(jsonb_typeof(x) = 'boolean' and (x #>> '{}')::boolean, false) order by n)
    into v from jsonb_array_elements(j) with ordinality as t(x, n);
  return v;
end $$;

-- piezas: [{"pieza": 16, "ausente": false, "implante": false, "movilidad": 1, "furca": 0,
--           "ps": [3,2,3,4,2,3], "mg": [0,0,1,0,0,0], "sangrado": [..6 booleanos], ...}, ...]
create function public.guardar_periodontograma(id_periodontograma uuid, piezas jsonb, observaciones text,
                                               mantenimiento_meses smallint)
returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
  v_p public.periodontograma;
  e jsonb;
  n int := 0;
  v_pieza smallint;
begin
  if not privado.ve_clinico() or privado.rol_actual() not in ('admin', 'odontologo', 'asistente') then
    raise exception 'El periodontograma lo registran el cirujano dentista o la asistente';
  end if;
  select * into v_p from public.periodontograma
   where id = id_periodontograma and clinica_id = privado.clinica_actual() for update;
  if v_p.id is null then
    raise exception 'Periodontograma no encontrado';
  end if;
  if v_p.anulado_at is not null or v_p.firmado_at is not null then
    raise exception 'Solo se registra en un periodontograma en borrador';
  end if;
  if auth.uid() is distinct from v_p.odontologo_id and auth.uid() is distinct from v_p.registrado_por then
    raise exception 'El borrador lo completan su responsable o quien lo registró';
  end if;
  if piezas is null or jsonb_typeof(piezas) <> 'array' or jsonb_array_length(piezas) > 32 then
    raise exception 'Datos de piezas inválidos';
  end if;
  for e in select * from jsonb_array_elements(piezas) loop
    n := n + 1;
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'pieza') <> 'number' then
      raise exception 'Pieza %: datos inválidos', n;
    end if;
    v_pieza := (e ->> 'pieza')::numeric::smallint;
    insert into public.periodonto_pieza (clinica_id, periodontograma_id, pieza, ausente, implante, movilidad, furca,
                                         ps, mg, sangrado, supuracion, placa)
    values (v_p.clinica_id, v_p.id, v_pieza,
            coalesce((e ->> 'ausente')::boolean, false), coalesce((e ->> 'implante')::boolean, false),
            case when jsonb_typeof(e -> 'movilidad') = 'number' then (e ->> 'movilidad')::numeric::smallint end,
            case when jsonb_typeof(e -> 'furca') = 'number' then (e ->> 'furca')::numeric::smallint end,
            privado.seis_numeros(e -> 'ps', v_pieza, 'la profundidad de sondaje'),
            privado.seis_numeros(e -> 'mg', v_pieza, 'el margen gingival'),
            privado.seis_marcas(e -> 'sangrado', v_pieza, 'el sangrado'),
            privado.seis_marcas(e -> 'supuracion', v_pieza, 'la supuración'),
            privado.seis_marcas(e -> 'placa', v_pieza, 'la placa'))
    on conflict (periodontograma_id, pieza) do update
      set ausente = excluded.ausente, implante = excluded.implante, movilidad = excluded.movilidad,
          furca = excluded.furca, ps = excluded.ps, mg = excluded.mg, sangrado = excluded.sangrado,
          supuracion = excluded.supuracion, placa = excluded.placa;
  end loop;
  update public.periodontograma
     set observaciones = nullif(left(btrim(observaciones), 2000), ''),
         mantenimiento_meses = mantenimiento_meses
   where id = v_p.id;
end $$;
revoke all on function public.guardar_periodontograma(uuid, jsonb, text, smallint) from public, anon;
grant execute on function public.guardar_periodontograma(uuid, jsonb, text, smallint) to authenticated;

create function public.firmar_periodontograma(id_periodontograma uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.periodontograma;
  v_previo text;
begin
  select * into v_p from public.periodontograma
   where id = id_periodontograma and clinica_id = privado.clinica_actual() for update;
  if v_p.id is null then
    raise exception 'Periodontograma no encontrado';
  end if;
  if not privado.es_dentista() or v_p.odontologo_id is distinct from auth.uid() then
    raise exception 'Solo el cirujano dentista responsable firma el periodontograma';
  end if;
  if v_p.anulado_at is not null or v_p.firmado_at is not null then
    raise exception 'El periodontograma ya está firmado o anulado';
  end if;
  if not exists (select 1 from public.periodonto_pieza where periodontograma_id = v_p.id
                   and not ausente and 0 <= any (ps)) then
    raise exception 'Registra al menos una medición de sondaje antes de firmar';
  end if;
  v_previo := coalesce(current_setting('dental.proceso', true), '');
  perform set_config('dental.proceso', 'on', true);
  update public.periodontograma set firmado_at = now() where id = v_p.id;
  perform set_config('dental.proceso', v_previo, true);
  -- Plan de mantenimiento: el control periodontal en los meses indicados.
  if v_p.mantenimiento_meses is not null then
    insert into public.seguimiento (clinica_id, paciente_id, tipo, fecha_programada, nota)
    values (v_p.clinica_id, v_p.paciente_id, 'mantenimiento_periodontal',
            ((now() at time zone 'America/Lima')::date + make_interval(months => v_p.mantenimiento_meses))::date,
            'Mantenimiento periodontal indicado en el periodontograma');
  end if;
end $$;
revoke all on function public.firmar_periodontograma(uuid) from public, anon;
grant execute on function public.firmar_periodontograma(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: personal clínico de la clínica. Sin DELETE (regla 1).
-- ---------------------------------------------------------------------------
create policy periodontograma_select on public.periodontograma for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
create policy periodontograma_insert on public.periodontograma for insert to authenticated
  with check (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));
-- En borrador lo editan el responsable y quien lo registró; la anulación, cualquiera del
-- personal clínico a su nombre (el trigger exige que sea a nombre propio y con motivo).
create policy periodontograma_update on public.periodontograma for update to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico())
         and (odontologo_id = (select auth.uid()) or registrado_por = (select auth.uid())
              or (select privado.es_dentista())))
  with check (clinica_id = (select privado.clinica_actual()));
create policy periodonto_pieza_select on public.periodonto_pieza for select to authenticated
  using (clinica_id = (select privado.clinica_actual()) and (select privado.ve_clinico()));

revoke all on public.periodontograma, public.periodonto_pieza from anon, authenticated;
grant select on public.periodontograma, public.periodonto_pieza to authenticated;
grant insert (clinica_id, paciente_id, odontologo_id, nota_id, observaciones, mantenimiento_meses)
  on public.periodontograma to authenticated;
grant update (observaciones, mantenimiento_meses, anulado_at, anulado_por, motivo_anulacion)
  on public.periodontograma to authenticated;
-- Las piezas se escriben solo con guardar_periodontograma().

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
  return jsonb_build_object('archivos', n_archivos, 'consentimientos', n_consentimientos, 'recetas', n_recetas,
                            'constancias', n_constancias, 'interconsultas', n_interconsultas,
                            'periodontogramas', n_periodontogramas);
end $$;

drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (clinica_id = (select privado.clinica_actual())
         and (select privado.rol_actual()) = 'admin'
         and (tabla not in ('nota_evolucion', 'odontograma', 'odontograma_hallazgo', 'cuestionario_salud',
                            'signos_vitales', 'historia_clinica', 'examen_clinico', 'diagnostico',
                            'diagnostico_adenda', 'evolucion_adenda', 'evolucion_item', 'archivo_clinico',
                            'consentimiento', 'receta', 'constancia', 'interconsulta', 'periodontograma')
              or (select privado.es_dentista())));
