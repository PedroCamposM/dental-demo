-- Complemento del seed para la Etapa 4 (v2): examen clínico y diagnósticos CIE-10.
--
-- Idempotente: se puede correr varias veces sin duplicar ni borrar nada.
-- Todo es ficticio y se deriva del odontograma inicial que ya tiene cada paciente:
-- el examen lo firma quien hizo el odontograma, en la misma fecha, y cada hallazgo
-- con código CIE-10 pasa a ser un diagnóstico (la pulpitis, presuntivo; el resto,
-- definitivo).

create function pg_temp.h(p uuid, sal text) returns int
language sql immutable as $$ select (('x' || substr(md5(p::text || sal), 1, 7))::bit(28)::int % 100) $$;

-- Examen clínico en la fecha del odontograma inicial
insert into public.examen_clinico (clinica_id, paciente_id, registrado_por, registrado_at, atm, ganglios, labios,
                                   mucosas, encia, lengua, paladar, piso_boca, higiene, oclusion)
select o.clinica_id, o.paciente_id, o.odontologo_id, o.fecha,
       case when pg_temp.h(o.paciente_id, 'atm') < 12 then 'Chasquido en ATM derecha a la apertura' else 'Sin alteraciones' end,
       'No palpables',
       'Sin alteraciones',
       'Sin alteraciones',
       case when pg_temp.h(o.paciente_id, 'encia') < 35 then 'Inflamación marginal generalizada, sangrado al sondaje'
            else 'Rosada, de consistencia firme' end,
       case when pg_temp.h(o.paciente_id, 'lengua') < 10 then 'Saburral' else 'Sin alteraciones' end,
       'Sin alteraciones',
       'Sin alteraciones',
       (array['buena', 'regular', 'regular', 'mala'])[1 + pg_temp.h(o.paciente_id, 'higiene') % 4],
       (array['Clase I de Angle', 'Clase I de Angle', 'Clase II de Angle', 'Clase III de Angle'])
         [1 + pg_temp.h(o.paciente_id, 'oclusion') % 4]
from public.odontograma o
join public.paciente p on p.id = o.paciente_id and p.anulado_at is null
where o.clinica_id = 'c0000000-0000-4000-8000-000000000001' and o.tipo = 'inicial' and o.anulado_at is null
  and not exists (select 1 from public.examen_clinico x where x.paciente_id = o.paciente_id);

-- Diagnósticos desde los hallazgos con código CIE-10
insert into public.diagnostico (clinica_id, paciente_id, cie10, tipo, pieza, superficies, hallazgo_id, examen_id,
                                registrado_por, registrado_at)
select o.clinica_id, o.paciente_id, h.cie10,
       case when h.cie10 = 'K04.0' then 'presuntivo' else 'definitivo' end,
       h.pieza, h.superficies, h.id,
       (select x.id from public.examen_clinico x where x.paciente_id = o.paciente_id order by x.registrado_at limit 1),
       o.odontologo_id, o.fecha + interval '5 minutes'
from public.odontograma_hallazgo h
join public.odontograma o on o.id = h.odontograma_id and o.anulado_at is null
join public.paciente p on p.id = o.paciente_id and p.anulado_at is null
join public.catalogo_cie10 c on c.codigo = h.cie10
where o.clinica_id = 'c0000000-0000-4000-8000-000000000001' and h.anulado_at is null and h.pieza is not null
  and not exists (select 1 from public.diagnostico d where d.hallazgo_id = h.id);

-- Una adenda en algunas pulpitis presuntivas (resultado de la prueba de vitalidad)
insert into public.diagnostico_adenda (clinica_id, diagnostico_id, texto, registrado_por, registrado_at)
select d.clinica_id, d.id, 'Prueba de frío: dolor intenso que persiste al retirar el estímulo.', d.registrado_por,
       d.registrado_at + interval '10 minutes'
from public.diagnostico d
where d.clinica_id = 'c0000000-0000-4000-8000-000000000001' and d.cie10 = 'K04.0' and d.anulado_at is null
  and pg_temp.h(d.id, 'adenda') < 50
  and not exists (select 1 from public.diagnostico_adenda a where a.diagnostico_id = d.id);
