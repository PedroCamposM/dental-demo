-- Verifica que supabase/seed.sql deje los casos que necesita el tablero.
-- Lo corre scripts/test-db.sh después de cargar el seed.

create function pg_temp.al_menos(obtenido bigint, minimo bigint, que text) returns void
language plpgsql as $$
begin
  if obtenido < minimo then
    raise exception 'seed — %: hay %, se esperaban al menos %', que, obtenido, minimo;
  end if;
end $$;

create function pg_temp.ninguno(obtenido bigint, que text) returns void
language plpgsql as $$
begin
  if obtenido <> 0 then
    raise exception 'seed — %: hay % casos', que, obtenido;
  end if;
end $$;

create view pg_temp.c as select 'c0000000-0000-4000-8000-000000000001'::uuid as id,
  (now() at time zone 'America/Lima')::date as hoy,
  date_trunc('month', now() at time zone 'America/Lima')::date as mes;

-- Volumen
select pg_temp.al_menos((select count(*) from paciente, pg_temp.c where clinica_id = c.id), 120, 'pacientes');
select pg_temp.ninguno((select count(*) - 120 from paciente, pg_temp.c where clinica_id = c.id), 'pacientes de más');
select pg_temp.al_menos((select count(*) from usuario, pg_temp.c
                         where clinica_id = c.id and rol in ('admin', 'odontologo') and cop is not null), 3, 'odontólogos');
select pg_temp.al_menos((select count(*) from auth.identities i join usuario u on u.id = i.user_id), 4,
                        'usuarios con identidad de Auth');
select pg_temp.al_menos((select count(*) from paciente, pg_temp.c
                         where clinica_id = c.id and fecha_nacimiento > c.hoy - interval '18 years'
                           and apoderado_dni is not null), 3, 'menores con apoderado');
select pg_temp.ninguno((select count(*) from paciente, pg_temp.c
                        where clinica_id = c.id and fecha_nacimiento > c.hoy - interval '18 years'
                          and apoderado_nombre is null), 'menores sin apoderado');

-- Etapa 1: asistente y filiación
select pg_temp.al_menos((select count(*) from usuario, pg_temp.c where clinica_id = c.id and rol = 'asistente'), 1,
                        'asistente');
select pg_temp.ninguno((select count(*) - 1 from usuario, pg_temp.c where clinica_id = c.id and rol = 'asistente'),
                       'asistentes duplicados (el complemento no es idempotente)');
select pg_temp.ninguno((select count(*) from paciente, pg_temp.c
                        where clinica_id = c.id and (sexo is null or ocupacion is null or direccion is null
                                                     or numero_documento is null)), 'pacientes sin filiación completa');
select pg_temp.ninguno((select count(*) from paciente, pg_temp.c
                        where clinica_id = c.id and apoderado_nombre is not null and apoderado_parentesco is null),
                       'apoderados sin parentesco');
select pg_temp.ninguno((select count(*) from paciente, pg_temp.c
                        where clinica_id = c.id and apoderado_nombre is null and contacto_emergencia_telefono is null),
                       'adultos sin contacto de emergencia');

-- Indicadores del tablero
select pg_temp.al_menos((select count(*) from plan_tratamiento, pg_temp.c
                         where clinica_id = c.id and presentado_at >= c.mes), 10, 'presupuestos presentados este mes');
select pg_temp.al_menos((select count(*) from plan_tratamiento, pg_temp.c
                         where clinica_id = c.id and aceptado_at >= c.mes), 5, 'presupuestos aceptados este mes');
select pg_temp.al_menos((select count(*) from plan_tratamiento, pg_temp.c
                         where clinica_id = c.id and estado = 'propuesto'), 20, 'presupuestos abiertos');
select pg_temp.al_menos((select count(*) from plan_tratamiento p join item_plan i on i.plan_id = p.id, pg_temp.c
                         where p.clinica_id = c.id and p.estado = 'propuesto' and i.procedimiento ilike 'implante%'
                           and p.presentado_at < now() - interval '30 days'), 3, 'implantes sin respuesta > 30 días');
select pg_temp.al_menos((select count(*) from v_plan_detenido, pg_temp.c where clinica_id = c.id), 10,
                        'tratamientos detenidos');
select pg_temp.al_menos((select count(distinct plan_id) from v_cuota_saldo, pg_temp.c
                         where clinica_id = c.id and vencida), 6, 'ortodoncias con cuotas vencidas');
select pg_temp.al_menos((select count(*) from seguimiento, pg_temp.c
                         where clinica_id = c.id and tipo = 'control' and resultado = 'pendiente'
                           and fecha_programada < c.hoy), 8, 'controles vencidos');
select pg_temp.al_menos((select count(*) from cita, pg_temp.c
                         where clinica_id = c.id and estado = 'no_asistio' and inicio >= c.mes), 3,
                        'no-show del mes');

-- Coherencia
select pg_temp.ninguno((select count(*) from plan_tratamiento p
                        where p.estado = 'terminado'
                          and not exists (select 1 from seguimiento s where s.plan_id = p.id and s.tipo = 'control')),
                       'planes terminados sin control (regla 3)');
select pg_temp.ninguno((select count(*) from plan_tratamiento p, pg_temp.c
                        where p.clinica_id = c.id and p.estado = 'terminado'
                          and exists (select 1 from item_plan i where i.plan_id = p.id and i.estado <> 'realizado')),
                       'planes terminados con ítems sin realizar');
select pg_temp.ninguno((select count(*) from plan_tratamiento p
                        join (select plan_id, sum(monto_centimos) total from cuota group by plan_id) q on q.plan_id = p.id
                        where q.total <> (select sum(precio_centimos) from item_plan i
                                          where i.plan_id = p.id and i.procedimiento ilike 'ortodoncia%')),
                       'cuotas que no suman el precio de la ortodoncia');
select pg_temp.ninguno((select count(*) from item_plan, pg_temp.c
                        where clinica_id = c.id and realizado_at > now()), 'ítems realizados en el futuro');
select pg_temp.ninguno((select count(*) from pago, pg_temp.c
                        where clinica_id = c.id and pagado_at > now()), 'pagos en el futuro');
select pg_temp.ninguno((select count(*) from cita, pg_temp.c
                        where clinica_id = c.id and estado in ('atendida', 'no_asistio') and inicio > now()),
                       'citas atendidas o no-show en el futuro');
select pg_temp.ninguno((select count(*) from cita, pg_temp.c
                        where clinica_id = c.id and estado in ('programada', 'confirmada') and inicio < now()),
                       'citas programadas en el pasado');
select pg_temp.ninguno((select count(*) from plan_tratamiento, pg_temp.c
                        where clinica_id = c.id and aceptado_at < presentado_at), 'aceptados antes de presentarse');
select pg_temp.al_menos((select count(*) from pago, pg_temp.c where clinica_id = c.id and anulado_at is not null), 2,
                        'pagos anulados');
select pg_temp.al_menos((select count(*) from v_item_cobro, pg_temp.c
                         where clinica_id = c.id and estado <> 'realizado' and cobrado_centimos > 0), 3,
                        'adelantos (cobrado sin realizar)');

-- Etapa 2: catálogo de procedimientos coherente con los planes del seed
select pg_temp.al_menos((select count(*) from procedimiento, pg_temp.c where clinica_id = c.id and activo), 20,
                        'procedimientos activos en el catálogo');
select pg_temp.ninguno((select count(*) from (select distinct i.procedimiento, i.precio_centimos
                                              from item_plan i, pg_temp.c where i.clinica_id = c.id) u
                        where not exists (select 1 from procedimiento p
                                          where p.nombre = u.procedimiento and p.precio_base_centimos = u.precio_centimos)),
                       'procedimientos de los planes que no están en el catálogo con su precio');

select pg_temp.ninguno((select count(*) - 18 from horario_profesional, pg_temp.c where clinica_id = c.id and activo),
                       'horarios distintos de 3 profesionales × 6 días');
select pg_temp.ninguno((select count(*) from cita, pg_temp.c
                        where clinica_id = c.id and estado in ('programada', 'confirmada') and inicio > now()
                          and sillon_id is null), 'citas futuras sin sillón');

select pg_temp.ninguno((select count(*) from cita a join cita b on b.clinica_id = a.clinica_id and b.id > a.id, pg_temp.c
                        where a.clinica_id = c.id and a.inicio > now()
                          and a.estado in ('programada', 'confirmada') and b.estado in ('programada', 'confirmada')
                          and (a.odontologo_id = b.odontologo_id or a.sillon_id = b.sillon_id or a.paciente_id = b.paciente_id)
                          and tstzrange(a.inicio, a.fin) && tstzrange(b.inicio, b.fin)),
                       'citas futuras superpuestas (profesional, sillón o paciente)');

-- Etapa 3: historia clínica coherente con los casos del guion
select pg_temp.ninguno((select count(*) from paciente p, pg_temp.c
                        where p.clinica_id = c.id and p.anulado_at is null
                          and not exists (select 1 from cuestionario_salud q where q.paciente_id = p.id)),
                       'pacientes sin historia clínica');
select pg_temp.al_menos((select count(distinct paciente_id) from cuestionario_salud, pg_temp.c
                         where clinica_id = c.id and 'Penicilina' = any (alergias)), 3, 'pacientes alérgicos a la penicilina');
select pg_temp.al_menos((select count(distinct paciente_id) from cuestionario_salud, pg_temp.c
                         where clinica_id = c.id and anticoagulado), 2, 'pacientes anticoagulados');
select pg_temp.al_menos((select count(distinct paciente_id) from cuestionario_salud, pg_temp.c
                         where clinica_id = c.id and embarazo = 'si'), 1, 'gestantes');
select pg_temp.al_menos((select count(*) from cuestionario_salud, pg_temp.c where clinica_id = c.id and version = 2), 3,
                        'historias con más de una versión');
select pg_temp.al_menos((select count(*) from signos_vitales, pg_temp.c where clinica_id = c.id), 30, 'signos vitales');
select pg_temp.ninguno((select count(*) from cuestionario_salud, pg_temp.c
                        where clinica_id = c.id and embarazo = 'si' and registrado_at < now() - interval '30 days'),
                       'embarazos registrados hace más de un mes (alerta desactualizada)');
select pg_temp.ninguno((select count(*) from cuestionario_salud q join usuario u on u.id = q.registrado_por
                        where u.rol not in ('admin', 'odontologo') or u.cop is null), 'historias firmadas por quien no es dentista');
select pg_temp.ninguno((select count(*) from cuestionario_salud q join paciente p on p.id = q.paciente_id
                        where q.embarazo = 'si' and (p.sexo <> 'femenino'
                              or extract(year from age(p.fecha_nacimiento)) not between 15 and 50)),
                       'embarazos incoherentes con sexo o edad');

select 'seed: todas las verificaciones pasaron' as resultado;
