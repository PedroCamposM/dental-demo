-- Complemento del seed para la Etapa 12 (v2): historia clínica coherente para la demo.
--
-- Sobre los tratamientos que ya trae el seed, agrega lo que pide CLAUDE.md («Datos de demo»):
-- - endodoncias realizadas con sus conductos (seguidas de coronas, que siguen en el plan);
-- - ortodoncias con diagnóstico y controles mensuales (arcos, ligaduras, activaciones);
-- - implantes con sus fases; uno en fase protésica;
-- - cirugías con técnica y sutura; la más reciente con el retiro de puntos pendiente;
-- - niños con apoderado presente y su conducta;
-- - dos periodontogramas por paciente en dos pacientes (para comparar fechas).
-- (Alertas, niños con apoderado, presupuestos, cuotas vencidas, detenidos y el trabajo de
-- laboratorio atrasado ya vienen de los seeds anteriores.)
--
-- Idempotente: cada bloque se salta si la clínica ya tiene esos registros.
-- Datos inventados. Los registros históricos se cargan como sistema (firmados en su fecha);
-- para ligar un ítem ya realizado a su sesión se desactiva un momento la validación de
-- «ítem trabajado en una evolución en borrador» (la sesión ya está firmada).
-- Local/CI: `supabase db reset` lo carga después de seed_etapa10.sql (config.toml).
-- Remoto: se aplica una vez sobre la clínica demo existente.

create or replace function pg_temp.h(t text) returns int language sql immutable as $$
  select ('x' || substr(md5(t), 1, 7))::bit(28)::int
$$;

do $$
declare
  c constant uuid := 'c0000000-0000-4000-8000-000000000001';
  ortodoncista constant uuid := 'd0000000-0000-4000-8000-000000000002';
  rehabilitadora constant uuid := 'd0000000-0000-4000-8000-000000000001';
  r record;
  v_nota uuid;
  v_impl uuid;
  v_caso_nota uuid;
  v_dia date;
  k int;
  v_canales text[];
  v_arcos text[] := array['NiTi 0.014', 'NiTi 0.016', 'NiTi 0.018', 'NiTi 0.016 x 0.022', 'Acero 0.019 x 0.025'];
  v_hoy date := (now() at time zone 'America/Lima')::date;
  v_p uuid;
  v_ultima uuid;
begin
  -- Ítems ya realizados: su sesión (evolución firmada) los registra como trabajados.
  alter table public.evolucion_item disable trigger validar;
  insert into public.evolucion_item (clinica_id, nota_id, item_id, trabajado, terminado)
  select i.clinica_id, i.nota_evolucion_id, i.id, true, true
    from public.item_plan i
   where i.clinica_id = c and i.estado = 'realizado' and i.nota_evolucion_id is not null
     and i.procedimiento ~* '^(Endodoncia|Exodoncia|Implante dental)'
  on conflict (nota_id, item_id) do nothing;
  alter table public.evolucion_item enable trigger validar;

  -- 1. Endodoncias: conductos según la pieza (molares superiores MV, DV, P; inferiores MV, ML, D).
  if not exists (select 1 from public.endodoncia_conducto where clinica_id = c) then
    for r in select i.id, i.pieza, i.nota_evolucion_id as nota, n.fecha, n.paciente_id
               from public.item_plan i join public.nota_evolucion n on n.id = i.nota_evolucion_id
              where i.clinica_id = c and i.estado = 'realizado' and i.procedimiento ilike 'Endodoncia%' loop
      v_canales := case when r.pieza / 10 in (1, 2) then array['MV', 'DV', 'P'] else array['MV', 'ML', 'D'] end;
      for k in 1..3 loop
        insert into public.endodoncia_conducto (clinica_id, paciente_id, nota_id, item_plan_id, conducto, longitud_trabajo_mm,
                                                referencia, lima_maestra, irrigacion, tecnica_obturacion, registrado_por, registrado_at)
        values (c, r.paciente_id, r.nota, r.id, v_canales[k],
                (19 + (pg_temp.h(r.id::text || k) % 5) + case when k = 3 then 1 else 0 end)::numeric + 0.5,
                case when k = 3 then 'Cúspide palatina/distal' else 'Cúspide mesiovestibular' end,
                'K ' || (30 + 5 * (pg_temp.h(r.id::text || k || 'l') % 3)),
                'Hipoclorito de sodio 2.5 % y EDTA 17 %', 'Condensación lateral', rehabilitadora, r.fecha);
      end loop;
    end loop;
  end if;

  -- 2. Cirugías: técnica y sutura; la más reciente con su retiro de puntos pendiente.
  if not exists (select 1 from public.cirugia_registro where clinica_id = c) then
    select i.id into v_ultima from public.item_plan i join public.nota_evolucion n on n.id = i.nota_evolucion_id
     where i.clinica_id = c and i.estado = 'realizado' and i.procedimiento ilike 'Exodoncia%'
     order by n.fecha desc limit 1;
    for r in select i.id, i.plan_id, i.procedimiento, i.pieza, i.nota_evolucion_id as nota, n.fecha, n.paciente_id, n.odontologo_id
               from public.item_plan i join public.nota_evolucion n on n.id = i.nota_evolucion_id
              where i.clinica_id = c and i.estado = 'realizado' and i.procedimiento ilike 'Exodoncia%' loop
      insert into public.cirugia_registro (clinica_id, paciente_id, nota_id, item_plan_id, tecnica, sutura, retiro_puntos_dias,
                                           registrado_por, registrado_at)
      values (c, r.paciente_id, r.nota, r.id,
              case when r.procedimiento ilike '%tercera molar%'
                   then 'Colgajo envolvente, osteotomía y odontosección; legrado y lavado con suero fisiológico'
                   else 'Sindesmotomía, luxación con elevador y extracción con fórceps' end,
              'Seda 3-0, ' || (1 + pg_temp.h(r.id::text) % 3) || ' puntos simples', case when r.id = v_ultima then 10 else 7 end,
              r.odontologo_id, r.fecha);
      if r.id = v_ultima then
        insert into public.seguimiento (clinica_id, paciente_id, plan_id, item_plan_id, tipo, fecha_programada, nota)
        values (c, r.paciente_id, r.plan_id, r.id, 'retiro_puntos', (r.fecha at time zone 'America/Lima')::date + 10,
                left('Retiro de puntos: ' || r.procedimiento || coalesce(' (pieza ' || r.pieza || ')', ''), 200))
        on conflict (item_plan_id) where item_plan_id is not null do nothing;
      end if;
    end loop;
  end if;

  -- 3. Implantes: datos del implante y sus fases (la colocación es la sesión de la cirugía).
  if not exists (select 1 from public.implante where clinica_id = c) then
    alter table public.implante disable trigger fase_inicial;
    for r in select i.id, i.pieza, i.nota_evolucion_id as nota, n.fecha, n.paciente_id, p.estado as plan
               from public.item_plan i join public.nota_evolucion n on n.id = i.nota_evolucion_id
               join public.plan_tratamiento p on p.id = i.plan_id
              where i.clinica_id = c and i.estado = 'realizado' and i.procedimiento ilike 'Implante dental%'
              order by n.fecha loop
      insert into public.implante (clinica_id, paciente_id, nota_id, item_plan_id, pieza, marca, diametro_mm, longitud_mm, lote,
                                   torque_ncm, registrado_por, registrado_at)
      values (c, r.paciente_id, r.nota, r.id, r.pieza, 'Implante cónico de titanio (marca de demo)',
              case when r.pieza % 10 >= 6 then 4.8 else 4.1 end, case when r.pieza % 10 >= 6 then 10 else 11.5 end,
              'DEMO-' || upper(substr(md5(r.id::text), 1, 6)), 35, rehabilitadora, r.fecha)
      returning id into v_impl;
      insert into public.implante_fase (clinica_id, paciente_id, nota_id, implante_id, fase, fecha, registrado_por, registrado_at)
      values (c, r.paciente_id, r.nota, v_impl, 'colocacion', (r.fecha at time zone 'America/Lima')::date, rehabilitadora, r.fecha);
      -- Control de oseointegración a los 60 días y fase protésica a los 120 (o la carga si el plan terminó).
      foreach k in array array[60, 120] loop
        v_dia := (r.fecha at time zone 'America/Lima')::date + k;
        exit when v_dia > v_hoy;
        insert into public.nota_evolucion (clinica_id, paciente_id, odontologo_id, texto, fecha)
        values (c, r.paciente_id, rehabilitadora,
                case k when 60 then 'Control del implante en ' || r.pieza || ': sin movilidad, tejidos blandos sanos. Oseointegración clínica.'
                       else 'Implante en ' || r.pieza || ': segunda fase y toma de impresión para la corona sobre implante.' end,
                (v_dia::timestamp + time '10:00') at time zone 'America/Lima')
        returning id into v_nota;
        insert into public.implante_fase (clinica_id, paciente_id, nota_id, implante_id, fase, fecha, registrado_por, registrado_at)
        values (c, r.paciente_id, v_nota, v_impl,
                case when k = 60 then 'oseointegracion' when r.plan = 'terminado' then 'carga' else 'protesica' end,
                v_dia, rehabilitadora, (v_dia::timestamp + time '10:00') at time zone 'America/Lima');
      end loop;
    end loop;
    alter table public.implante enable trigger fase_inicial;
  end if;

  -- 4. Ortodoncias: diagnóstico y controles mensuales en los primeros 6 tratamientos en curso.
  if not exists (select 1 from public.ortodoncia_control where clinica_id = c) then
    alter table public.evolucion_item disable trigger validar;
    for r in select i.id, p.paciente_id from public.item_plan i join public.plan_tratamiento p on p.id = i.plan_id
              where i.clinica_id = c and i.procedimiento ilike 'Ortodoncia fija%' and i.estado = 'aceptado' and p.estado = 'en_curso'
              order by i.id limit 6 loop
      v_caso_nota := null;
      for k in reverse 5..1 loop
        v_dia := v_hoy - 30 * k + (pg_temp.h(r.id::text) % 5);
        insert into public.nota_evolucion (clinica_id, paciente_id, odontologo_id, texto, fecha)
        values (c, r.paciente_id, ortodoncista,
                case when k = 5 then 'Instalación de aparatología fija superior e inferior.'
                     else 'Control mensual de ortodoncia. Paciente con buena higiene.' end,
                (v_dia::timestamp + time '16:00') at time zone 'America/Lima')
        returning id into v_nota;
        insert into public.evolucion_item (clinica_id, nota_id, item_id, trabajado, terminado) values (c, v_nota, r.id, true, false);
        if k = 5 then
          v_caso_nota := v_nota;
          insert into public.ortodoncia_caso (clinica_id, paciente_id, nota_id, item_plan_id, diagnostico, aparatologia, registrado_por, registrado_at)
          values (c, r.paciente_id, v_nota, r.id,
                  case pg_temp.h(r.id::text) % 3 when 0 then 'Maloclusión clase I de Angle con apiñamiento anterior moderado'
                       when 1 then 'Maloclusión clase II división 1 de Angle con resalte aumentado'
                       else 'Maloclusión clase I de Angle con mordida cruzada posterior unilateral' end,
                  'Aparatología fija con brackets metálicos de slot 0.022 en ambas arcadas', ortodoncista,
                  (v_dia::timestamp + time '16:00') at time zone 'America/Lima');
        end if;
        insert into public.ortodoncia_control (clinica_id, paciente_id, nota_id, item_plan_id, arco_superior, arco_inferior,
                                               ligaduras, activaciones, observaciones, registrado_por, registrado_at)
        values (c, r.paciente_id, v_nota, r.id, v_arcos[6 - k], v_arcos[6 - k],
                'Elastoméricas ' || case k % 2 when 0 then 'grises' else 'transparentes' end,
                case when k <= 2 then 'Cadeneta elástica de canino a canino' else null end,
                case when k = 5 then 'Inicio del tratamiento' else 'Sin brackets despegados' end,
                ortodoncista, (v_dia::timestamp + time '16:00') at time zone 'America/Lima');
      end loop;
    end loop;
    alter table public.evolucion_item enable trigger validar;
  end if;

  -- 5. Niños: apoderado presente y conducta en sus sesiones.
  if not exists (select 1 from public.odontopediatria_registro where clinica_id = c) then
    insert into public.odontopediatria_registro (clinica_id, paciente_id, nota_id, apoderado_presente, acompanante,
                                                 conducta_frankl, conducta, registrado_por, registrado_at)
    select c, n.paciente_id, n.id, true,
           p.apoderado_nombre || coalesce(' (' || p.apoderado_parentesco || ')', ''),
           3 + pg_temp.h(n.id::text) % 2,
           case pg_temp.h(n.id::text) % 2 when 0 then 'Colaboró con la técnica decir-mostrar-hacer'
                else 'Colaboró durante toda la sesión' end,
           n.odontologo_id, n.fecha
      from public.nota_evolucion n join public.paciente p on p.id = n.paciente_id
     where n.clinica_id = c and n.anulado_at is null and n.firmada_at is not null and p.apoderado_nombre is not null
       and p.fecha_nacimiento > (n.fecha at time zone 'America/Lima')::date - interval '18 years';
  end if;

  -- 6. Periodontogramas: dos por paciente (hace 6 meses y hace 1) en dos pacientes, con mejoría.
  if not exists (select 1 from public.periodontograma where clinica_id = c) then
    perform set_config('dental.proceso', 'on', true);
    for r in select distinct on (p.paciente_id) p.paciente_id
               from public.item_plan i join public.plan_tratamiento p on p.id = i.plan_id
               join public.paciente pa on pa.id = p.paciente_id
              where i.clinica_id = c and i.procedimiento ilike 'Profilaxis%' and i.estado = 'realizado'
                and pa.fecha_nacimiento < v_hoy - interval '30 years' and pa.anulado_at is null
              order by p.paciente_id limit 2 loop
      foreach k in array array[180, 30] loop
        insert into public.periodontograma (clinica_id, paciente_id, odontologo_id, registrado_por, fecha, observaciones,
                                            mantenimiento_meses)
        values (c, r.paciente_id, 'd0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003',
                ((v_hoy - k)::timestamp + time '11:00') at time zone 'America/Lima',
                case k when 180 then 'Inflamación gingival generalizada; se indica raspado y alisado radicular.'
                       else 'Control: menor sangrado al sondaje y bolsas más superficiales.' end,
                case k when 30 then 6 end)
        returning id into v_p;
        insert into public.periodonto_pieza (clinica_id, periodontograma_id, pieza, ausente, movilidad, furca, ps, mg, sangrado, placa)
        select c, v_p, d.pieza, d.pieza % 10 = 8, case when d.pieza % 10 = 8 then null else 0 end,
               case when d.pieza % 10 in (6, 7) then 0 end,
               case when d.pieza % 10 = 8 then '{null,null,null,null,null,null}'::smallint[] else d.ps end,
               case when d.pieza % 10 = 8 then '{null,null,null,null,null,null}'::smallint[] else '{0,0,0,0,0,0}'::smallint[] end,
               case when d.pieza % 10 = 8 then '{f,f,f,f,f,f}'::boolean[] else array(select x >= 4 from unnest(d.ps) x) end,
               case when d.pieza % 10 = 8 then '{f,f,f,f,f,f}'::boolean[]
                    else array(select pg_temp.h(v_p::text || d.pieza || s) % 4 = 0 from generate_series(1, 6) s) end
          from (select t.pieza,
                       array(select (2 + pg_temp.h(r.paciente_id::text || t.pieza || s) % 3
                                     + case when k = 180 and t.pieza % 10 in (6, 7) and s in (1, 3) then 2 else 0 end)::smallint
                               from generate_series(1, 6) s) as ps
                  from unnest(array[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38]) t(pieza)) d;
        update public.periodontograma set firmado_at = fecha + interval '20 minutes' where id = v_p;
      end loop;
    end loop;
    perform set_config('dental.proceso', 'off', true);
  end if;
end $$;
