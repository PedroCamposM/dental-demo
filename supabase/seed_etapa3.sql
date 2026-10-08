-- Complemento del seed para la Etapa 3 (v2): historia clínica y signos vitales.
--
-- Idempotente: se puede correr varias veces sin duplicar ni borrar nada.
-- Todo es ficticio y se deriva del id del paciente (md5): sale igual en cada carga.
-- Incluye los casos que pide el guion: alergia a penicilina, pacientes
-- anticoagulados, hipertensos, diabéticos, una gestante y niños con hábitos.

-- 0–99 estable por paciente y «sal»
create function pg_temp.h(p uuid, sal text) returns int
language sql immutable as $$ select (('x' || substr(md5(p::text || sal), 1, 7))::bit(28)::int % 100) $$;

create temp table pg_temp.base as
select p.id, p.clinica_id, p.sexo, p.fecha_nacimiento,
       extract(year from age(p.fecha_nacimiento))::int as edad,
       coalesce((select min(c.inicio) from public.cita c where c.paciente_id = p.id and c.estado = 'atendida'),
                p.created_at) as primera,
       (select max(c.inicio) from public.cita c where c.paciente_id = p.id and c.estado = 'atendida') as ultima,
       (select c.id from public.cita c where c.paciente_id = p.id and c.estado = 'atendida' order by c.inicio desc limit 1) as ultima_cita,
       (select pl.titulo from public.plan_tratamiento pl where pl.paciente_id = p.id order by pl.presentado_at limit 1) as plan
from public.paciente p
where p.clinica_id = 'c0000000-0000-4000-8000-000000000001' and p.anulado_at is null and p.fecha_nacimiento is not null;

create temp table pg_temp.datos as
select b.*,
       case when pg_temp.h(b.id, 'alergia') < 9 then array['Penicilina']
            when pg_temp.h(b.id, 'alergia') < 12 then array['AINES (ibuprofeno, naproxeno)']
            when pg_temp.h(b.id, 'alergia') < 14 then array['Látex']
            else '{}'::text[] end as alergias,
       (b.edad >= 50 and pg_temp.h(b.id, 'anticoag') < 14) as anticoagulado,
       case when pg_temp.h(b.id, 'anticoag-tipo') < 60 then 'Warfarina 5 mg diaria' else 'Apixabán 5 mg cada 12 horas' end
         as anticoagulante,
       (b.edad >= 40 and pg_temp.h(b.id, 'hta') < 22) as hipertension,
       (b.edad >= 40 and pg_temp.h(b.id, 'dm') < 12) as diabetes,
       (b.edad >= 12 and pg_temp.h(b.id, 'asma') < 5) as asma,
       (b.sexo = 'femenino' and b.edad between 20 and 40
        and (pg_temp.h(b.id, 'gestante') < 12
             or b.id = (select x.id from pg_temp.base x where x.sexo = 'femenino' and x.edad between 20 and 40
                        order by x.id limit 1))) as gestante
from pg_temp.base b;

-- Versión 1: la primera consulta
insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, registrado_at, motivo_consulta,
  enfermedad_actual, enfermedades, cirugias, medicacion, anticoagulado, anticoagulante, alergias, embarazo,
  semanas_gestacion, habitos, antecedentes_odontologicos)
select d.clinica_id, d.id, 'd0000000-0000-4000-8000-000000000001', d.primera,
       coalesce('Evaluación para ' || lower(d.plan), 'Control y limpieza dental'),
       case pg_temp.h(d.id, 'actual') % 4
         when 0 then 'Refiere sensibilidad al frío desde hace unas semanas.'
         when 1 then 'Refiere sangrado de encías al cepillarse.'
         when 2 then 'Sin molestias; acude por control.'
         else null end,
       array_remove(array[case when d.hipertension then 'hipertension' end, case when d.diabetes then 'diabetes' end,
                          case when d.asma then 'asma' end,
                          case when d.anticoagulado then 'cardiopatia' end], null),
       case when pg_temp.h(d.id, 'cirugia') < 15 and d.edad >= 18 then 'Apendicectomía' end,
       nullif(concat_ws('; ', case when d.hipertension then 'Losartán 50 mg diario' end,
                              case when d.diabetes then 'Metformina 850 mg cada 12 horas' end,
                              case when d.asma then 'Salbutamol inhalado a demanda' end,
                              case when d.anticoagulado then d.anticoagulante end), ''),
       d.anticoagulado, case when d.anticoagulado then d.anticoagulante end,
       d.alergias,
       case when d.edad < 12 or d.sexo = 'masculino' then 'no_aplica' when d.gestante then 'si' else 'no' end,
       case when d.gestante then (12 + pg_temp.h(d.id, 'semanas') % 20)::smallint end,
       array_remove(array[case when d.edad >= 18 and pg_temp.h(d.id, 'bruxismo') < 14 then 'bruxismo' end,
                          case when d.edad >= 18 and pg_temp.h(d.id, 'tabaco') < 10 then 'tabaco' end,
                          case when d.edad < 12 and pg_temp.h(d.id, 'succion') < 30 then 'succion_digital' end,
                          case when pg_temp.h(d.id, 'onicofagia') < 8 then 'onicofagia' end], null),
       case pg_temp.h(d.id, 'previos') % 3
         when 0 then 'Última visita al dentista hace más de un año.'
         when 1 then 'Tratamientos previos de restauraciones; sin complicaciones con la anestesia.'
         else 'Primera visita a esta clínica.' end
from pg_temp.datos d
where not exists (select 1 from public.cuestionario_salud c where c.paciente_id = d.id);

-- Versión 2 para algunos pacientes con controles: la historia se actualiza sin borrar la anterior
insert into public.cuestionario_salud (clinica_id, paciente_id, registrado_por, registrado_at, motivo_consulta,
  enfermedad_actual, enfermedades, cirugias, medicacion, anticoagulado, anticoagulante, alergias, embarazo,
  semanas_gestacion, habitos, antecedentes_odontologicos, observaciones)
select c.clinica_id, c.paciente_id, 'd0000000-0000-4000-8000-000000000003', d.ultima,
       'Control', 'Sin molestias.', c.enfermedades, c.cirugias,
       nullif(concat_ws('; ', c.medicacion, 'Omeprazol 20 mg en ayunas'), ''), c.anticoagulado, c.anticoagulante,
       c.alergias, c.embarazo, c.semanas_gestacion, c.habitos, c.antecedentes_odontologicos,
       'Actualización en el control: inició omeprazol.'
from public.cuestionario_salud c
join pg_temp.datos d on d.id = c.paciente_id
where c.version = 1 and d.ultima is not null and d.ultima > d.primera + interval '20 days'
  and pg_temp.h(d.id, 'version2') < 15
  and not exists (select 1 from public.cuestionario_salud v where v.paciente_id = c.paciente_id and v.version > 1);

-- Signos vitales en la última consulta atendida (los registró la asistente)
insert into public.signos_vitales (clinica_id, paciente_id, cita_id, registrado_por, registrado_at, presion_sistolica,
  presion_diastolica, frecuencia_cardiaca, frecuencia_respiratoria, temperatura_c, peso_kg, talla_cm)
select d.clinica_id, d.id, d.ultima_cita, 'd0000000-0000-4000-8000-000000000005', d.ultima,
       case when d.edad >= 12 then (case when d.hipertension then 138 else 108 end + pg_temp.h(d.id, 'pas') % 14)::smallint end,
       case when d.edad >= 12 then (case when d.hipertension then 86 else 68 end + pg_temp.h(d.id, 'pad') % 10)::smallint end,
       (64 + pg_temp.h(d.id, 'fc') % 24)::smallint,
       (14 + pg_temp.h(d.id, 'fr') % 5)::smallint,
       (36.2 + (pg_temp.h(d.id, 'temp') % 7) / 10.0)::numeric(3, 1),
       case when d.edad < 12 then 20 + pg_temp.h(d.id, 'peso') % 20 else 52 + pg_temp.h(d.id, 'peso') % 40 end,
       case when d.edad < 12 then 115 + pg_temp.h(d.id, 'talla') % 30 else 152 + pg_temp.h(d.id, 'talla') % 30 end
from pg_temp.datos d
where d.ultima_cita is not null and pg_temp.h(d.id, 'signos') < 70
  and exists (select 1 from public.usuario where id = 'd0000000-0000-4000-8000-000000000005')
  and not exists (select 1 from public.signos_vitales s where s.cita_id = d.ultima_cita);
