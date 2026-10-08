-- Complemento del seed para la Etapa 2 (v2): catálogo de procedimientos.
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
