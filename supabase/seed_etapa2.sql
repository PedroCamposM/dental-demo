-- Complemento del seed para la Etapa 2 (v2): catálogo de procedimientos, sillones,
-- horarios de los profesionales y un feriado.
--
-- Idempotente: se puede correr varias veces sin duplicar ni borrar nada.
-- Local/CI: `supabase db reset` lo carga después de seed_etapa1.sql (config.toml).
-- Remoto: se aplica una vez sobre la clínica demo existente.
-- Precios y duraciones de demostración (los de los planes del seed coinciden);
-- cada clínica los ajusta en Configuración → Procedimientos.

insert into public.procedimiento (clinica_id, codigo, nombre, especialidad, precio_base_centimos,
                                  duracion_minutos, requiere_consentimiento, control_dias)
select 'c0000000-0000-4000-8000-000000000001', v.codigo, v.nombre, v.especialidad::public.especialidad,
       v.precio, v.minutos, v.consentimiento, v.control
from (values
  ('GEN-01', 'Consulta y evaluación inicial',                                  'general',          5000,  30, false, null),
  ('GEN-02', 'Radiografía periapical',                                         'general',          3000,  15, false, null),
  ('PRE-01', 'Profilaxis y destartraje',                                       'preventiva',      15000,  45, false, 180),
  ('PRE-02', 'Aplicación de flúor',                                            'preventiva',       6000,  20, false, null),
  ('PRE-03', 'Sellante de fosas y fisuras (por pieza)',                        'preventiva',       5000,  20, false, null),
  ('OPE-01', 'Restauración con resina compuesta',                              'operatoria',      18000,  45, false, null),
  ('END-01', 'Endodoncia unirradicular',                                       'endodoncia',      45000,  60, true,  null),
  ('END-02', 'Endodoncia multirradicular',                                     'endodoncia',      75000,  90, true,  null),
  ('PER-01', 'Raspado y alisado radicular (por cuadrante)',                    'periodoncia',     20000,  60, false, 90),
  ('CIR-01', 'Exodoncia simple',                                               'cirugia',         12000,  30, true,  7),
  ('CIR-02', 'Exodoncia de tercera molar retenida',                            'cirugia',         45000,  60, true,  7),
  ('CIR-03', 'Injerto óseo con membrana',                                      'cirugia',        120000,  90, true,  10),
  ('ORT-01', 'Estudio ortodóntico (radiografías, modelos y fotos)',            'ortodoncia',      25000,  45, false, null),
  ('ORT-02', 'Ortodoncia fija con brackets metálicos (tratamiento completo)',  'ortodoncia',     480000,  90, true,  30),
  ('ORT-03', 'Control de ortodoncia',                                          'ortodoncia',          0,  30, false, 30),
  ('IMP-01', 'Implante dental de titanio (fase quirúrgica)',                   'implantes',      350000,  90, true,  10),
  ('REH-01', 'Espigo-muñón de fibra de vidrio',                                'rehabilitacion',  35000,  45, false, null),
  ('REH-02', 'Corona de zirconio',                                             'rehabilitacion', 180000,  60, false, null),
  ('REH-03', 'Corona de zirconio sobre implante',                              'rehabilitacion', 180000,  60, false, null),
  ('REH-04', 'Prótesis parcial fija de 3 piezas metal-cerámica',               'rehabilitacion', 330000,  90, false, null),
  ('REH-05', 'Prótesis parcial removible metálica',                            'rehabilitacion', 150000,  60, false, null),
  ('PED-01', 'Pulpotomía en pieza temporal',                                   'odontopediatria', 15000,  45, true,  null),
  ('EST-01', 'Blanqueamiento dental en consultorio',                           'estetica',        60000,  90, true,  null)
) as v(codigo, nombre, especialidad, precio, minutos, consentimiento, control)
where exists (select 1 from public.clinica where id = 'c0000000-0000-4000-8000-000000000001')
on conflict (clinica_id, codigo) do nothing;

-- ---------------------------------------------------------------------------
-- Sillones y horarios (lunes a sábado de 9:00 a 19:00, como las citas del seed)
-- ---------------------------------------------------------------------------
insert into public.sillon (clinica_id, nombre)
select 'c0000000-0000-4000-8000-000000000001', s.nombre
from (values ('Sillón 1'), ('Sillón 2'), ('Sillón 3')) as s(nombre)
where exists (select 1 from public.clinica where id = 'c0000000-0000-4000-8000-000000000001')
on conflict (clinica_id, (lower(btrim(nombre)))) do nothing;

insert into public.horario_profesional (clinica_id, profesional_id, sillon_id, dia_semana, hora_inicio, hora_fin)
select 'c0000000-0000-4000-8000-000000000001', p.profesional::uuid, s.id, d.dia, time '09:00', time '19:00'
from (values ('d0000000-0000-4000-8000-000000000001', 'Sillón 1'),    -- Dra. Valverde
             ('d0000000-0000-4000-8000-000000000003', 'Sillón 2'),    -- Dra. Mendoza
             ('d0000000-0000-4000-8000-000000000002', 'Sillón 3'))    -- Dr. Alvarado (ortodoncia)
     as p(profesional, sillon)
join public.sillon s on s.clinica_id = 'c0000000-0000-4000-8000-000000000001' and s.nombre = p.sillon
cross join generate_series(1, 6) as d(dia)
where exists (select 1 from public.usuario where id = p.profesional::uuid)
  -- (la validación del horario corre antes del on conflict: no se reintenta lo que ya existe)
  and not exists (select 1 from public.horario_profesional h
                  where h.profesional_id = p.profesional::uuid and h.dia_semana = d.dia)
on conflict (profesional_id, dia_semana) do nothing;

-- Las citas futuras ya agendadas toman el sillón de su profesional
update public.cita c set sillon_id = h.sillon_id
from public.horario_profesional h
where c.clinica_id = 'c0000000-0000-4000-8000-000000000001' and c.sillon_id is null
  and c.estado in ('programada', 'confirmada') and c.inicio > now()
  and h.profesional_id = c.odontologo_id and h.activo
  and h.dia_semana = extract(isodow from c.inicio at time zone 'America/Lima');

-- El seed v1 agendaba citas de 45 min en turnos de 30: las futuras que se superponen
-- (por profesional, sillón o paciente) se acortan a 30 min, como la agenda exige.
update public.cita c set fin = c.inicio + interval '30 minutes'
where c.clinica_id = 'c0000000-0000-4000-8000-000000000001'
  and c.estado in ('programada', 'confirmada') and c.inicio > now() and c.fin - c.inicio > interval '30 minutes'
  and exists (select 1 from public.cita o
              where o.clinica_id = c.clinica_id and o.id <> c.id and o.estado in ('programada', 'confirmada')
                and (o.odontologo_id = c.odontologo_id or o.sillon_id = c.sillon_id or o.paciente_id = c.paciente_id)
                and tstzrange(o.inicio, o.fin) && tstzrange(c.inicio, c.fin));

-- Feriado nacional del 8 de diciembre (Inmaculada Concepción), si no choca con citas
insert into public.bloqueo_agenda (clinica_id, tipo, motivo, inicio, fin, creado_por)
select 'c0000000-0000-4000-8000-000000000001', 'feriado', 'Feriado: Inmaculada Concepción',
       (f.dia + time '00:00') at time zone 'America/Lima', (f.dia + 1 + time '00:00') at time zone 'America/Lima',
       'd0000000-0000-4000-8000-000000000001'
from (select make_date(extract(year from now() at time zone 'America/Lima')::int
                       + case when (now() at time zone 'America/Lima')::date > make_date(extract(year from now() at time zone 'America/Lima')::int, 12, 8)
                              then 1 else 0 end, 12, 8) as dia) f
where exists (select 1 from public.usuario where id = 'd0000000-0000-4000-8000-000000000001')
  and not exists (select 1 from public.bloqueo_agenda b
                  where b.clinica_id = 'c0000000-0000-4000-8000-000000000001' and b.tipo = 'feriado'
                    and b.inicio = (f.dia + time '00:00') at time zone 'America/Lima')
  and not exists (select 1 from public.cita c
                  where c.clinica_id = 'c0000000-0000-4000-8000-000000000001' and c.estado in ('programada', 'confirmada')
                    and (c.inicio at time zone 'America/Lima')::date = f.dia);
