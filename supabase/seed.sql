-- Datos de demo: "Clínica Dental Demo – Trujillo"
--
-- TODO ES FICTICIO: nombres, DNI, teléfonos y COP se generan al azar. Nunca
-- usar datos reales de pacientes.
--
-- Las fechas se calculan desde hoy (America/Lima), así el tablero siempre
-- muestra casos vigentes. setseed() hace que los datos salgan iguales en cada
-- carga del mismo día.
--
-- Se carga con `supabase db reset` (local) o una sola vez sobre un proyecto
-- con las migraciones aplicadas. Si la clínica demo ya existe, se detiene.
--
-- Usuarios (contraseña de demo: DemoTrujillo2026):
--   valverde@clinica-demo.example   admin + odontóloga (rehabilitación e implantes)
--   alvarado@clinica-demo.example   odontólogo (ortodoncia)
--   mendoza@clinica-demo.example    odontóloga (general y endodoncia)
--   recepcion@clinica-demo.example  recepción
--
-- Casos (120 pacientes):
--   A  12  ortodoncia al día
--   B   8  ortodoncia con cuotas atrasadas (3 además sin cita: detenidos)
--   C   8  presupuesto de implante sin respuesta (3 con alternativa B)
--   D  10  otros presupuestos abiertos
--   E   6  presupuestos rechazados
--   F  10  tratamientos detenidos (sin cita hace más de un mes)
--   G  14  tratamientos en curso con cita próxima (3 con no-show este mes)
--   H  10  terminados hace 7–10 meses: control vencido
--   I  12  terminados en los últimos meses (2 con saldo pendiente)
--   K  15  presupuestos presentados este mes (9 aceptados)
--   J  15  profilaxis terminadas (10) y pacientes nuevos con cita (5)
--
-- Variables de las plantillas: {{nombre}}, {{paciente}}, {{clinica}},
-- {{tratamiento}}, {{monto}}, {{fecha}}, {{cuotas}}, {{numero}}.

do $$
begin
  if exists (select 1 from public.clinica where id = 'c0000000-0000-4000-8000-000000000001') then
    raise exception 'El seed ya fue aplicado: la clínica demo existe';
  end if;
end $$;

select setseed(0.2026);

-- ---------------------------------------------------------------------------
-- Clínica, usuarios de Auth y equipo
-- ---------------------------------------------------------------------------
insert into public.clinica (id, nombre, ruc)
values ('c0000000-0000-4000-8000-000000000001', 'Clínica Dental Demo – Trujillo', '20000000001');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('DemoTrujillo2026', extensions.gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}', jsonb_build_object('nombre', u.nombre),
       now(), now(), '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'valverde@clinica-demo.example',  'Dra. Lucía Valverde Ríos'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'alvarado@clinica-demo.example',  'Dr. Martín Alvarado Cruz'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'mendoza@clinica-demo.example',   'Dra. Carla Mendoza Paredes'),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'recepcion@clinica-demo.example', 'Rosa Chávez Liñán')
) as u (id, email, nombre);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users where email like '%@clinica-demo.example';

insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Dra. Lucía Valverde Ríos',   'admin',      '31452'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Dr. Martín Alvarado Cruz',   'odontologo', '28719'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Dra. Carla Mendoza Paredes', 'odontologo', '40236'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Rosa Chávez Liñán',          'recepcion',  null);

insert into public.plantilla_mensaje (clinica_id, tipo, nombre, cuerpo) values
  ('c0000000-0000-4000-8000-000000000001', 'presupuesto', 'Presupuesto sin respuesta',
   'Hola {{nombre}}, le saluda {{clinica}}. Le escribimos por el presupuesto de {{tratamiento}} que le presentamos el {{fecha}}. ¿Tiene alguna duda que podamos resolver? Podemos coordinar su cita cuando le acomode.'),
  ('c0000000-0000-4000-8000-000000000001', 'tratamiento_detenido', 'Tratamiento pendiente',
   'Hola {{nombre}}, le saluda {{clinica}}. Notamos que su tratamiento de {{tratamiento}} quedó pendiente. Es importante continuarlo para no perder lo avanzado. ¿Le reservamos una cita esta semana?'),
  ('c0000000-0000-4000-8000-000000000001', 'cuota_vencida', 'Recordatorio de cuota',
   'Hola {{nombre}}, le saluda {{clinica}}. Le recordamos que tiene {{cuotas}} de su tratamiento por {{monto}}; la más antigua venció el {{fecha}}. Puede pagar por Yape, Plin o transferencia y enviarnos la constancia por aquí. ¡Gracias!'),
  ('c0000000-0000-4000-8000-000000000001', 'control', 'Control periódico',
   'Hola {{nombre}}, le saluda {{clinica}}. Ya le toca su control dental. ¿Le reservamos una cita? Responda este mensaje y coordinamos el horario.'),
  ('c0000000-0000-4000-8000-000000000001', 'no_show', 'Cita perdida',
   'Hola {{nombre}}, le saluda {{clinica}}. Le esperábamos el {{fecha}} y no pudo venir. ¿Le reprogramamos la cita? Díganos qué día y hora le acomodan.');

-- ---------------------------------------------------------------------------
-- Ayudantes (solo viven durante esta sesión)
-- ---------------------------------------------------------------------------
create function pg_temp.azar(a int, b int) returns int
language sql volatile as $$ select a + floor(random() * (b - a + 1))::int $$;

create function pg_temp.elegir(opciones text[]) returns text
language sql volatile as $$ select opciones[1 + floor(random() * cardinality(opciones))::int] $$;

create function pg_temp.hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Lima')::date $$;

-- Sin domingos: lo pasado retrocede al sábado, lo futuro avanza al lunes.
create function pg_temp.habil(d date) returns date
language sql stable as $$
  select case when extract(isodow from d) <> 7 then d
              when d < pg_temp.hoy() then d - 1 else d + 1 end
$$;

-- Turnos de 30 min desde las 9:00 (hora de Lima).
create function pg_temp.hora(d date, turno int) returns timestamptz
language sql stable as $$
  select (pg_temp.habil(d) + time '09:00' + make_interval(mins => 30 * turno)) at time zone 'America/Lima'
$$;

-- Momento ya ocurrido de ese día (nunca después de ahora).
create function pg_temp.pasado(d date) returns timestamptz
language sql volatile as $$
  select least(pg_temp.hora(d, pg_temp.azar(0, 18)), now() - interval '10 minutes')
$$;

create table pg_temp.proc (
  cod text primary key, nombre text not null, precio int not null, cie10 text
);
insert into pg_temp.proc values
  ('estudio_orto',   'Estudio ortodóntico (radiografías, modelos y fotos)',          25000,  'K07.3'),
  ('orto_brackets',  'Ortodoncia fija con brackets metálicos (tratamiento completo)', 480000, 'K07.3'),
  ('profilaxis',     'Profilaxis y destartraje',                                     15000,  'K03.6'),
  ('resina',         'Restauración con resina compuesta',                            18000,  'K02.1'),
  ('endo_multi',     'Endodoncia multirradicular',                                   75000,  'K04.0'),
  ('espigo',         'Espigo-muñón de fibra de vidrio',                              35000,  'K08.8'),
  ('corona_zr',      'Corona de zirconio',                                           180000, 'K08.8'),
  ('implante',       'Implante dental de titanio (fase quirúrgica)',                 350000, 'K08.1'),
  ('corona_impl',    'Corona de zirconio sobre implante',                            180000, 'K08.1'),
  ('injerto',        'Injerto óseo con membrana',                                    120000, 'K08.2'),
  ('ppf',            'Prótesis parcial fija de 3 piezas metal-cerámica',             330000, 'K08.1'),
  ('ppr',            'Prótesis parcial removible metálica',                          150000, 'K08.1'),
  ('exodoncia',      'Exodoncia simple',                                             12000,  'K08.3'),
  ('tercera_molar',  'Exodoncia de tercera molar retenida',                          45000,  'K01.1'),
  ('blanqueamiento', 'Blanqueamiento dental en consultorio',                         60000,  'K03.7');

create function pg_temp.paciente(p_i int, p_edad_min int, p_edad_max int, p_alta date) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_mujer boolean := random() < 0.55;
  v_edad int := pg_temp.azar(p_edad_min, p_edad_max);
  v_ap1 text := pg_temp.elegir(array['Rodríguez','Vásquez','Castillo','Gutiérrez','Alvarado','Paredes','Mendoza',
    'Chávez','Rojas','Reyes','Díaz','Sánchez','Cruz','Ramírez','Torres','Flores','León','Ruiz','Benites','Lescano',
    'Zavaleta','Otiniano','Rebaza','Ganoza','Polo','Aguilar','Asmat','Horna','Sifuentes','Cabrera','Moreno','Velásquez']);
  v_ap2 text := pg_temp.elegir(array['Rodríguez','Vásquez','Castillo','Gutiérrez','Silva','Paredes','Medina','Rojas',
    'Pérez','Díaz','Sánchez','Cruz','Ramírez','Torres','Flores','Quispe','Ruiz','Lozano','Vega','Tello','Pinillos',
    'Burgos','Ávalos','Arana','Neyra','Varas','Llanos','Ponce','Cerna','Salazar']);
  v_nombre text := case when v_mujer
    then pg_temp.elegir(array['María','Rosa','Carmen','Ana','Lucía','Sofía','Valeria','Camila','Andrea','Fiorella',
      'Milagros','Jimena','Patricia','Gabriela','Elena','Diana','Karla','Mariela','Yesenia','Ximena','Daniela','Gloria'])
    else pg_temp.elegir(array['José','Luis','Carlos','Jorge','Juan','Miguel','Diego','Renzo','Sebastián','Mateo',
      'Alonso','Ricardo','Víctor','Fernando','Óscar','Raúl','César','Manuel','Gustavo','Bruno','Piero','Hugo']) end;
  v_menor boolean := v_edad < 18;
  v_alta timestamptz := pg_temp.pasado(p_alta);
begin
  insert into public.paciente (clinica_id, dni, nombres, apellidos, telefono, fecha_nacimiento,
                               apoderado_nombre, apoderado_dni, apoderado_telefono,
                               consentimiento_datos_at, created_at, updated_at)
  values ('c0000000-0000-4000-8000-000000000001',
          lpad((40000000 + p_i * 73127)::text, 8, '0'),
          v_nombre, v_ap1 || ' ' || v_ap2,
          case when not v_menor then '519' || lpad(pg_temp.azar(0, 99999999)::text, 8, '0') end,
          (pg_temp.hoy() - make_interval(years => v_edad) - make_interval(days => pg_temp.azar(0, 360)))::date,
          case when v_menor then pg_temp.elegir(array['María','Rosa','Carmen','Ana','Patricia','José','Luis','Carlos','Jorge'])
                                 || ' ' || v_ap1 || ' ' || pg_temp.elegir(array['Silva','Medina','Pérez','Vega','Tello']) end,
          case when v_menor then lpad((10000000 + p_i * 91813)::text, 8, '0') end,
          case when v_menor then '519' || lpad(pg_temp.azar(0, 99999999)::text, 8, '0') end,
          v_alta, v_alta, v_alta)
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.cita(p_pac uuid, p_odont uuid, p_inicio timestamptz, p_estado public.estado_cita,
                             p_items uuid[] default '{}', p_nota text default null) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.cita (clinica_id, paciente_id, odontologo_id, inicio, fin, estado, nota)
  values ('c0000000-0000-4000-8000-000000000001', p_pac, p_odont, p_inicio,
          p_inicio + interval '45 minutes', p_estado, p_nota)
  returning id into v_id;
  insert into public.cita_item (clinica_id, cita_id, item_plan_id)
  select 'c0000000-0000-4000-8000-000000000001', v_id, unnest(p_items);
  return v_id;
end $$;

-- Un pago con un solo método; se aplica al ítem y/o cuota indicados.
create function pg_temp.pagar(p_plan uuid, p_monto int, p_fecha date,
                              p_item uuid default null, p_cuota uuid default null) returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_metodo public.metodo_pago := pg_temp.elegir(array['yape','yape','yape','yape','efectivo','efectivo','efectivo',
    'plin','tarjeta','tarjeta','transferencia'])::public.metodo_pago;
begin
  insert into public.pago (clinica_id, plan_id, monto_centimos, metodo, pagado_at, referencia, registrado_por)
  values ('c0000000-0000-4000-8000-000000000001', p_plan, p_monto, v_metodo, pg_temp.pasado(p_fecha),
          case when v_metodo <> 'efectivo' then lpad(pg_temp.azar(0, 99999999)::text, 8, '0') end,
          case when random() < 0.85 then 'd0000000-0000-4000-8000-000000000004'::uuid
               else 'd0000000-0000-4000-8000-000000000001'::uuid end)
  returning id into v_id;
  if p_item is not null or p_cuota is not null then
    insert into public.pago_aplicacion (clinica_id, pago_id, item_plan_id, cuota_id, monto_centimos)
    values ('c0000000-0000-4000-8000-000000000001', v_id, p_item, p_cuota, p_monto);
  end if;
  return v_id;
end $$;

-- Ítem del plan. Si está realizado: nota de evolución firmada por el
-- odontólogo del plan (regla 1) y cita atendida ese día.
create function pg_temp.item(p_plan uuid, p_cod text, p_pieza int, p_sup text[], p_estado public.estado_item,
                             p_orden int, p_fecha date default null) returns uuid
language plpgsql as $$
declare
  v_proc pg_temp.proc;
  v_plan public.plan_tratamiento;
  v_nota uuid;
  v_id uuid;
  v_momento timestamptz;
begin
  select * into v_proc from pg_temp.proc where cod = p_cod;
  select * into v_plan from public.plan_tratamiento where id = p_plan;
  if p_estado = 'realizado' then
    v_momento := pg_temp.pasado(least(p_fecha, pg_temp.hoy()));
    insert into public.nota_evolucion (clinica_id, paciente_id, odontologo_id, texto, cie10, fecha)
    values (v_plan.clinica_id, v_plan.paciente_id, v_plan.odontologo_id,
            'Se realiza ' || lower(v_proc.nombre) || coalesce(' en pieza ' || p_pieza, '')
              || '. Procedimiento sin complicaciones. Se entregan indicaciones.',
            v_proc.cie10, v_momento)
    returning id into v_nota;
    -- Solo un cirujano dentista marca "realizado": se firma como el odontólogo del plan.
    perform set_config('request.jwt.claim.sub', v_plan.odontologo_id::text, true);
  end if;
  insert into public.item_plan (clinica_id, plan_id, pieza, superficies, procedimiento, cie10, precio_centimos,
                                odontologo_id, estado, nota_evolucion_id, realizado_at, orden)
  values (v_plan.clinica_id, p_plan, p_pieza, p_sup, v_proc.nombre, v_proc.cie10, v_proc.precio,
          v_plan.odontologo_id, p_estado, v_nota, v_momento, p_orden)
  returning id into v_id;
  perform set_config('request.jwt.claim.sub', '', true);
  if p_estado = 'realizado' then
    perform pg_temp.cita(v_plan.paciente_id, v_plan.odontologo_id, v_momento, 'atendida', array[v_id]);
  end if;
  return v_id;
end $$;

create function pg_temp.odontograma(p_pac uuid, p_odont uuid, p_fecha date, p_esp text default null) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.odontograma (clinica_id, paciente_id, tipo, fecha, odontologo_id, especificaciones)
  values ('c0000000-0000-4000-8000-000000000001', p_pac, 'inicial', pg_temp.pasado(p_fecha), p_odont, p_esp)
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.hallazgo(p_odo uuid, p_cod text, p_pieza int, p_sup text[], p_siglas text[],
                                 p_estado public.estado_hallazgo default null, p_cie text default null) returns void
language sql as $$
  insert into public.odontograma_hallazgo (clinica_id, odontograma_id, hallazgo_codigo, pieza, superficies,
                                           siglas, estado, cie10)
  values ('c0000000-0000-4000-8000-000000000001', p_odo, p_cod, p_pieza, p_sup, p_siglas, p_estado, p_cie)
$$;

-- Paquetes de tratamiento: ítems con pieza y superficies (FDI, nombres anatómicos).
--   1 rehabilitación de pieza   2 operatoria   3 implante   4 estética
--   5 terceras molares          6 prótesis removible        7 prótesis fija (alternativa al implante)
--   8 profilaxis
create function pg_temp.paquete(p int, out titulo text, out items jsonb)
language plpgsql as $$
declare
  v_post int[] := array[16, 17, 26, 27, 36, 37, 46, 47];
  v_pieza int := v_post[pg_temp.azar(1, 8)];
  v_impl int := (array[14, 15, 24, 25, 35, 36, 45, 46])[pg_temp.azar(1, 8)];
  v_n int;
  v_piezas int[];
begin
  items := '[]';
  case p
  when 1 then
    titulo := 'Rehabilitación de pieza ' || v_pieza;
    items := jsonb_build_array(
      jsonb_build_object('cod', 'endo_multi', 'pieza', v_pieza),
      jsonb_build_object('cod', 'espigo', 'pieza', v_pieza),
      jsonb_build_object('cod', 'corona_zr', 'pieza', v_pieza));
  when 2 then
    titulo := 'Operatoria dental';
    items := jsonb_build_array(jsonb_build_object('cod', 'profilaxis'));
    v_n := pg_temp.azar(2, 4);
    select array_agg(x) into v_piezas from (select x from unnest(v_post) x order by random() limit v_n) s;
    for i in 1 .. v_n loop
      items := items || jsonb_build_array(jsonb_build_object('cod', 'resina', 'pieza', v_piezas[i],
        'sup', jsonb_build_array('oclusal') || case when random() < 0.5
          then jsonb_build_array(pg_temp.elegir(array['mesial', 'distal'])) else '[]' end));
    end loop;
  when 3 then
    titulo := 'Rehabilitación con implante en pieza ' || v_impl;
    items := jsonb_build_array(jsonb_build_object('cod', 'implante', 'pieza', v_impl));
    if random() < 0.4 then
      items := items || jsonb_build_array(jsonb_build_object('cod', 'injerto', 'pieza', v_impl));
    end if;
    items := items || jsonb_build_array(jsonb_build_object('cod', 'corona_impl', 'pieza', v_impl));
  when 4 then
    titulo := 'Estética dental';
    items := jsonb_build_array(
      jsonb_build_object('cod', 'profilaxis'),
      jsonb_build_object('cod', 'blanqueamiento'),
      jsonb_build_object('cod', 'resina', 'pieza', 11, 'sup', jsonb_build_array('mesial', 'incisal')),
      jsonb_build_object('cod', 'resina', 'pieza', 21, 'sup', jsonb_build_array('distal', 'incisal')));
  when 5 then
    titulo := 'Cirugía de terceras molares';
    items := jsonb_build_array(
      jsonb_build_object('cod', 'tercera_molar', 'pieza', 38),
      jsonb_build_object('cod', 'tercera_molar', 'pieza', 48));
  when 6 then
    titulo := 'Prótesis parcial removible inferior';
    items := jsonb_build_array(
      jsonb_build_object('cod', 'exodoncia', 'pieza', 46),
      jsonb_build_object('cod', 'ppr'));
  when 7 then
    titulo := 'Prótesis fija de 3 piezas (alternativa al implante)';
    items := jsonb_build_array(jsonb_build_object('cod', 'ppf'));
  when 8 then
    titulo := 'Profilaxis';
    items := jsonb_build_array(jsonb_build_object('cod', 'profilaxis'));
  else
    null;   -- 0: el llamador pasa sus propios ítems (ortodoncia)
  end case;
end $$;

-- Hallazgos del odontograma inicial que justifican cada ítem (catálogo NTS 188).
create function pg_temp.hallazgos_de(p_odo uuid, p_items jsonb) returns void
language plpgsql as $$
declare
  v jsonb;
  v_pieza int;
begin
  for v in select * from jsonb_array_elements(p_items) loop
    v_pieza := (v ->> 'pieza')::int;
    case v ->> 'cod'
    when 'resina' then
      perform pg_temp.hallazgo(p_odo, 'caries', v_pieza,
        array(select jsonb_array_elements_text(v -> 'sup')), '{CD}', null, 'K02.1');
    when 'endo_multi' then
      perform pg_temp.hallazgo(p_odo, 'caries', v_pieza, '{oclusal}', '{CDP}', null, 'K04.0');
    when 'implante' then
      perform pg_temp.hallazgo(p_odo, 'pieza_ausente', v_pieza, null, '{DEX}', null, 'K08.1');
    when 'tercera_molar' then
      perform pg_temp.hallazgo(p_odo, 'impactacion', v_pieza, null, '{I}', null, 'K01.1');
    when 'exodoncia' then
      perform pg_temp.hallazgo(p_odo, 'remanente_radicular', v_pieza, null, '{RR}', null, 'K08.3');
    when 'ppr' then
      perform pg_temp.hallazgo(p_odo, 'pieza_ausente', 36, null, '{DEX}', null, 'K08.1');
    when 'ppf' then
      perform pg_temp.hallazgo(p_odo, 'pieza_ausente', 46, null, '{DEX}', null, 'K08.1');
    else null;
    end case;
  end loop;
  if random() < 0.3 then   -- restauración antigua en buen estado (azul)
    perform pg_temp.hallazgo(p_odo, 'restauracion_definitiva', 37, '{oclusal}', '{AM}', 'bueno');
  end if;
end $$;

-- Paga un ítem realizado: casi siempre completo; a veces mixto (dos métodos).
create function pg_temp.pagar_item(p_item uuid, p_fecha date, p_fraccion numeric default 1) returns void
language plpgsql as $$
declare
  v_i public.item_plan;
  v_monto int;
begin
  select * into v_i from public.item_plan where id = p_item;
  v_monto := (v_i.precio_centimos * p_fraccion)::int;
  if v_monto <= 0 then return; end if;
  if p_fraccion = 1 and v_monto >= 40000 and random() < 0.25 then
    perform pg_temp.pagar(v_i.plan_id, v_monto / 2, p_fecha, p_item);
    perform pg_temp.pagar(v_i.plan_id, v_monto - v_monto / 2, p_fecha, p_item);
  else
    perform pg_temp.pagar(v_i.plan_id, v_monto, p_fecha, p_item);
  end if;
end $$;

-- Plan de tratamiento genérico.
--   p_aceptado null  -> plan propuesto (o rechazado si hay motivo)
--   p_realizados     -> cuántos ítems ya se hicieron, cada p_cada días desde p_aceptado
-- Devuelve el plan; el llamador agenda citas futuras, termina el plan, etc.
create function pg_temp.tratamiento(p_pac uuid, p_odont uuid, p_paquete int, p_presentado date,
                                    p_aceptado date default null, p_realizados int default 0, p_cada int default 10,
                                    p_motivo_rechazo text default null, p_alternativa char default 'A',
                                    p_items jsonb default null, p_titulo text default null) returns uuid
language plpgsql as $$
declare
  v_paq record;
  v_items jsonb;
  v_titulo text;
  v_plan uuid;
  v_odo uuid;
  v_item uuid;
  v jsonb;
  v_n int := 0;
  v_fecha date;
  v_presentado timestamptz := pg_temp.pasado(p_presentado);
begin
  select * into v_paq from pg_temp.paquete(p_paquete);
  v_items := coalesce(p_items, v_paq.items);
  v_titulo := coalesce(p_titulo, v_paq.titulo);

  insert into public.plan_tratamiento (clinica_id, paciente_id, odontologo_id, titulo, alternativa, estado,
                                       motivo_rechazo, presentado_at, fecha_vencimiento, aceptado_at, created_at)
  values ('c0000000-0000-4000-8000-000000000001', p_pac, p_odont, v_titulo, p_alternativa,
          case when p_motivo_rechazo is not null then 'rechazado'
               when p_aceptado is null then 'propuesto'
               when p_realizados > 0 then 'en_curso' else 'aceptado' end::public.estado_plan,
          p_motivo_rechazo, v_presentado, p_presentado + 30,
          case when p_aceptado is not null then greatest(pg_temp.pasado(p_aceptado), v_presentado) end, v_presentado)
  returning id into v_plan;

  if p_alternativa = 'A' then
    v_odo := pg_temp.odontograma(p_pac, p_odont, p_presentado,
      case when p_paquete in (2, 4, 8) then 'Placa bacteriana y cálculo supragingival' end);
    perform pg_temp.hallazgos_de(v_odo, v_items);
    perform pg_temp.cita(p_pac, p_odont, v_presentado, 'atendida', '{}',
                         'Evaluación y presentación de presupuesto');
  end if;

  for v in select * from jsonb_array_elements(v_items) loop
    v_n := v_n + 1;
    if p_aceptado is not null and v_n <= p_realizados then
      v_fecha := least(p_aceptado + (v_n - 1) * p_cada, pg_temp.hoy() - 1);
      v_item := pg_temp.item(v_plan, v ->> 'cod', (v ->> 'pieza')::int,
                             case when v ? 'sup' then array(select jsonb_array_elements_text(v -> 'sup')) end,
                             'realizado', v_n, v_fecha);
      perform pg_temp.pagar_item(v_item, v_fecha);
    else
      perform pg_temp.item(v_plan, v ->> 'cod', (v ->> 'pieza')::int,
                           case when v ? 'sup' then array(select jsonb_array_elements_text(v -> 'sup')) end,
                           case when p_aceptado is null then 'propuesto' else 'aceptado' end::public.estado_item,
                           v_n);
    end if;
  end loop;
  return v_plan;
end $$;

create function pg_temp.primer_pendiente(p_plan uuid) returns uuid
language sql as $$
  select id from public.item_plan where plan_id = p_plan and estado = 'aceptado' order by orden limit 1
$$;

create function pg_temp.terminar(p_plan uuid) returns void
language sql as $$
  -- El trigger de la regla 3 crea el seguimiento de control a 6 meses.
  update public.plan_tratamiento p
  set estado = 'terminado',
      terminado_at = (select max(realizado_at) from public.item_plan i where i.plan_id = p.id)
  where p.id = p_plan
$$;

create function pg_temp.seguimiento(p_pac uuid, p_plan uuid, p_tipo public.tipo_seguimiento, p_fecha date,
                                    p_resultado public.resultado_seguimiento default 'pendiente',
                                    p_nota text default null, p_cuota uuid default null) returns void
language sql as $$
  insert into public.seguimiento (clinica_id, paciente_id, plan_id, cuota_id, tipo, fecha_programada, resultado,
                                  nota, plantilla_id, mensaje_enviado, realizado_at, realizado_por)
  select 'c0000000-0000-4000-8000-000000000001', p_pac, p_plan, p_cuota, p_tipo, p_fecha, p_resultado, p_nota,
         case when p_resultado <> 'pendiente' then t.id end,
         case when p_resultado <> 'pendiente' then t.cuerpo end,
         case when p_resultado <> 'pendiente' then pg_temp.pasado(least(p_fecha, pg_temp.hoy())) end,
         case when p_resultado <> 'pendiente' then 'd0000000-0000-4000-8000-000000000004'::uuid end
  from (select null) x
  left join public.plantilla_mensaje t on t.tipo = p_tipo
    and t.clinica_id = 'c0000000-0000-4000-8000-000000000001'
$$;

-- Ortodoncia financiada: inicial S/ 800 + 20 cuotas mensuales de S/ 200.
-- p_atrasadas: últimas cuotas vencidas sin pagar. Sin cita futura = detenido.
create function pg_temp.ortodoncia(p_pac uuid, p_meses int, p_atrasadas int, p_con_cita boolean) returns void
language plpgsql as $$
declare
  c_odont constant uuid := 'd0000000-0000-4000-8000-000000000002';
  v_inicio date := pg_temp.hoy() - (p_meses * 30 + pg_temp.azar(0, 20));
  v_presentado date := v_inicio - pg_temp.azar(5, 15);
  v_plan uuid;
  v_orto uuid;
  v_odo uuid;
  v_cuota uuid;
  v_vence date;
  v_vencidas int;
  v_primera_impaga uuid;
  v_fecha date;
  v_meses_asiste int;
begin
  v_plan := pg_temp.tratamiento(p_pac, c_odont, 0, v_presentado, v_inicio - pg_temp.azar(1, 4), 1, 0,
    p_items => jsonb_build_array(jsonb_build_object('cod', 'estudio_orto'), jsonb_build_object('cod', 'orto_brackets')),
    p_titulo => 'Ortodoncia fija con brackets metálicos');
  -- tratamiento() ya puso el odontograma con los hallazgos de los ítems; se agregan los de ortodoncia
  select id into v_odo from public.odontograma where paciente_id = p_pac;
  perform pg_temp.hallazgo(v_odo, 'posicion_anormal', 13, null, '{V}');
  perform pg_temp.hallazgo(v_odo, 'giroversion', 12, null, '{}');
  v_orto := pg_temp.primer_pendiente(v_plan);

  select count(*) into v_vencidas
  from generate_series(0, 20) n where (v_inicio + make_interval(months => n))::date <= pg_temp.hoy();

  for n in 1 .. 21 loop
    v_vence := (v_inicio + make_interval(months => n - 1))::date;
    insert into public.cuota (clinica_id, plan_id, numero, monto_centimos, vence_el)
    values ('c0000000-0000-4000-8000-000000000001', v_plan, n, case when n = 1 then 80000 else 20000 end, v_vence)
    returning id into v_cuota;
    if v_vence <= pg_temp.hoy() then
      if n <= v_vencidas - p_atrasadas then
        perform pg_temp.pagar(v_plan, case when n = 1 then 80000 else 20000 end,
                              least(v_vence + pg_temp.azar(-3, 4), pg_temp.hoy()), v_orto, v_cuota);
      elsif v_primera_impaga is null then
        v_primera_impaga := v_cuota;
        perform pg_temp.seguimiento(p_pac, v_plan, 'cuota_vencida', v_vence + 3,
          case when random() < 0.5 then 'mensaje_enviado' else 'pendiente' end::public.resultado_seguimiento,
          null, v_cuota);
      end if;
    end if;
  end loop;

  -- Controles mensuales. Quien deja de pagar suele dejar de venir.
  v_meses_asiste := case when p_atrasadas >= 2 and not p_con_cita then v_vencidas - p_atrasadas else v_vencidas end;
  for m in 0 .. v_meses_asiste - 1 loop
    v_fecha := (v_inicio + make_interval(months => m))::date + pg_temp.azar(0, 3);
    exit when v_fecha >= pg_temp.hoy();
    perform pg_temp.cita(p_pac, c_odont, pg_temp.pasado(v_fecha),
      case when random() < 0.1 then 'no_asistio' else 'atendida' end::public.estado_cita, array[v_orto],
      case when m = 0 then 'Instalación de brackets' else 'Control de ortodoncia' end);
  end loop;

  if p_con_cita then
    v_fecha := (v_inicio + make_interval(months => v_vencidas))::date;
    if v_fecha <= pg_temp.hoy() or v_fecha > pg_temp.hoy() + 28 then
      v_fecha := pg_temp.hoy() + pg_temp.azar(2, 25);
    end if;
    perform pg_temp.cita(p_pac, c_odont, pg_temp.hora(v_fecha, pg_temp.azar(0, 18)),
      pg_temp.elegir(array['programada', 'confirmada'])::public.estado_cita, array[v_orto], 'Control de ortodoncia');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Pacientes y sus casos
-- ---------------------------------------------------------------------------
do $$
declare
  c_valverde constant uuid := 'd0000000-0000-4000-8000-000000000001';
  c_mendoza  constant uuid := 'd0000000-0000-4000-8000-000000000003';
  v_hoy date := pg_temp.hoy();
  v_mes date := date_trunc('month', pg_temp.hoy())::date;
  v_pac uuid;
  v_plan uuid;
  v_item uuid;
  v_odont uuid;
  v_fecha date;
  v_fecha2 date;
  v_n int;
  i int := 0;
begin
  -- A: ortodoncia al día
  for k in 1 .. 12 loop
    i := i + 1;
    v_pac := pg_temp.paciente(i, 11, 32, v_hoy - 190);
    perform pg_temp.ortodoncia(v_pac, pg_temp.azar(2, 6), 0, true);
  end loop;

  -- B: ortodoncia con cuotas atrasadas; los 3 primeros además sin cita
  for k in 1 .. 8 loop
    i := i + 1;
    v_pac := pg_temp.paciente(i, 12, 30, v_hoy - 190);
    perform pg_temp.ortodoncia(v_pac, pg_temp.azar(4, 6), pg_temp.azar(1, 3) + case when k <= 3 then 1 else 0 end,
                               k > 3);
  end loop;

  -- C: presupuestos de implante sin respuesta
  for k in 1 .. 8 loop
    i := i + 1;
    v_fecha := v_hoy - pg_temp.azar(5, 120);
    v_pac := pg_temp.paciente(i, 38, 72, v_fecha);
    v_plan := pg_temp.tratamiento(v_pac, c_valverde, 3, v_fecha);
    if k <= 3 then
      perform pg_temp.tratamiento(v_pac, c_valverde, 7, v_fecha, p_alternativa => 'B');
    end if;
    if v_fecha + 7 < v_hoy then
      perform pg_temp.seguimiento(v_pac, v_plan, 'presupuesto', v_fecha + 7,
        pg_temp.elegir(array['mensaje_enviado', 'no_contesta', 'contactado'])::public.resultado_seguimiento,
        case when random() < 0.5 then 'Dice que lo está evaluando con su familia' end);
    end if;
    if v_fecha + 30 < v_hoy then
      perform pg_temp.seguimiento(v_pac, v_plan, 'presupuesto', v_fecha + 30);
    end if;
  end loop;

  -- D: otros presupuestos abiertos
  for k in 1 .. 10 loop
    i := i + 1;
    v_fecha := v_hoy - pg_temp.azar(1, 75);
    v_pac := pg_temp.paciente(i, 18, 65, v_fecha);
    v_plan := pg_temp.tratamiento(v_pac, case when random() < 0.5 then c_valverde else c_mendoza end,
                                  (array[1, 2, 4, 5])[pg_temp.azar(1, 4)], v_fecha);
    if v_fecha + 7 < v_hoy and random() < 0.6 then
      perform pg_temp.seguimiento(v_pac, v_plan, 'presupuesto', v_fecha + 7,
        pg_temp.elegir(array['mensaje_enviado', 'no_contesta', 'pendiente'])::public.resultado_seguimiento);
    end if;
  end loop;

  -- E: presupuestos rechazados
  for k in 1 .. 6 loop
    i := i + 1;
    v_fecha := v_hoy - pg_temp.azar(20, 170);
    v_pac := pg_temp.paciente(i, 20, 70, v_fecha);
    perform pg_temp.tratamiento(v_pac, case when random() < 0.5 then c_valverde else c_mendoza end,
      (array[1, 3, 4, 6])[pg_temp.azar(1, 4)], v_fecha,
      p_motivo_rechazo => pg_temp.elegir(array['Precio fuera de su presupuesto',
        'Prefiere consultar en otra clínica', 'Viaja fuera de Trujillo por trabajo',
        'Solo quería atender la urgencia']));
  end loop;

  -- F: tratamientos detenidos (aceptados, sin cita hace más de un mes)
  for k in 1 .. 10 loop
    i := i + 1;
    v_fecha := v_hoy - pg_temp.azar(70, 170);
    v_pac := pg_temp.paciente(i, 25, 68, v_fecha - 10);
    v_n := (array[1, 2, 3, 6])[pg_temp.azar(1, 4)];
    v_odont := case when v_n in (1, 3) then c_valverde else c_mendoza end;
    v_plan := pg_temp.tratamiento(v_pac, v_odont, v_n, v_fecha - pg_temp.azar(1, 10), v_fecha,
                                  case when v_n = 2 then 2 else 1 end, 10);
    v_item := pg_temp.primer_pendiente(v_plan);
    if random() < 0.3 then   -- adelanto: cobrado en parte sin estar realizado
      perform pg_temp.pagar_item(v_item, v_fecha + 15, 0.5);
    end if;
    if random() < 0.4 then
      perform pg_temp.cita(v_pac, v_odont, pg_temp.pasado(v_fecha + 40), 'no_asistio', array[v_item]);
    end if;
    if random() < 0.5 then
      perform pg_temp.seguimiento(v_pac, v_plan, 'tratamiento_detenido', v_hoy - pg_temp.azar(1, 15),
        pg_temp.elegir(array['pendiente', 'no_contesta'])::public.resultado_seguimiento);
    end if;
  end loop;

  -- G: en curso con cita próxima; 3 faltaron a una cita este mes
  for k in 1 .. 14 loop
    i := i + 1;
    v_fecha := v_hoy - pg_temp.azar(10, 60);
    v_pac := pg_temp.paciente(i, 18, 70, v_fecha - 10);
    v_n := (array[1, 2, 2, 3, 4, 5, 6])[pg_temp.azar(1, 7)];
    v_odont := case when v_n in (1, 3) then c_valverde else c_mendoza end;
    v_plan := pg_temp.tratamiento(v_pac, v_odont, v_n, v_fecha - pg_temp.azar(1, 7), v_fecha,
                                  pg_temp.azar(0, 1), 7);
    v_item := pg_temp.primer_pendiente(v_plan);
    if k <= 3 then
      perform pg_temp.cita(v_pac, v_odont,
        pg_temp.pasado(v_mes + pg_temp.azar(0, greatest(v_hoy - v_mes - 1, 0))), 'no_asistio', array[v_item]);
    end if;
    if random() < 0.25 then
      perform pg_temp.pagar_item(v_item, v_hoy - pg_temp.azar(1, 5), 0.5);
    end if;
    perform pg_temp.cita(v_pac, v_odont, pg_temp.hora(v_hoy + pg_temp.azar(1, 25), pg_temp.azar(0, 18)),
      pg_temp.elegir(array['programada', 'confirmada'])::public.estado_cita, array[v_item]);
  end loop;

  -- H: terminados hace 7–10 meses: control vencido
  for k in 1 .. 10 loop
    i := i + 1;
    v_fecha := v_hoy - pg_temp.azar(230, 320);
    v_pac := pg_temp.paciente(i, 20, 70, v_fecha - 10);
    v_n := (array[1, 2, 2, 4, 5, 8])[pg_temp.azar(1, 6)];
    v_plan := pg_temp.tratamiento(v_pac, case when v_n in (1, 3) then c_valverde else c_mendoza end,
                                  v_n, v_fecha - pg_temp.azar(1, 7), v_fecha, 99, 10);
    perform pg_temp.terminar(v_plan);
  end loop;

  -- I: terminados en los últimos meses; 2 con saldo pendiente
  for k in 1 .. 12 loop
    i := i + 1;
    v_fecha := v_hoy - pg_temp.azar(60, 170);
    v_pac := pg_temp.paciente(i, 18, 70, v_fecha - 10);
    v_n := (array[1, 2, 3, 4, 5, 6])[pg_temp.azar(1, 6)];
    v_plan := pg_temp.tratamiento(v_pac, case when v_n in (1, 3) then c_valverde else c_mendoza end,
                                  v_n, v_fecha - pg_temp.azar(1, 7), v_fecha, 99, 10);
    if k <= 2 then   -- recepción anula el pago del último ítem y se registra solo la mitad
      select id into v_item from public.item_plan where plan_id = v_plan order by orden desc limit 1;
      perform set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000004', true);
      update public.pago set anulado_at = now(), anulado_por = 'd0000000-0000-4000-8000-000000000004',
                             motivo_anulacion = 'Voucher rechazado por el banco'
      where id in (select pago_id from public.pago_aplicacion where item_plan_id = v_item);
      perform set_config('request.jwt.claim.sub', '', true);
      perform pg_temp.pagar_item(v_item, v_hoy - 3, 0.5);
    end if;
    perform pg_temp.terminar(v_plan);
  end loop;

  -- K: presupuestos presentados este mes (9 aceptados con cita, 6 sin respuesta)
  for k in 1 .. 15 loop
    i := i + 1;
    v_fecha := v_mes + pg_temp.azar(0, v_hoy - v_mes);
    v_pac := pg_temp.paciente(i, 16, 70, v_fecha);
    v_n := (array[1, 2, 2, 3, 4, 5, 6])[pg_temp.azar(1, 7)];
    v_odont := case when v_n in (1, 3) then c_valverde else c_mendoza end;
    if k <= 9 then
      v_fecha2 := least(v_fecha + pg_temp.azar(0, 2), v_hoy);
      v_plan := pg_temp.tratamiento(v_pac, v_odont, v_n, v_fecha, v_fecha2);
      v_item := pg_temp.primer_pendiente(v_plan);
      if random() < 0.4 then
        perform pg_temp.pagar_item(v_item, v_fecha2, 0.5);
      end if;
      perform pg_temp.cita(v_pac, v_odont, pg_temp.hora(v_hoy + pg_temp.azar(1, 20), pg_temp.azar(0, 18)),
        'programada', array[v_item]);
    else
      perform pg_temp.tratamiento(v_pac, v_odont, v_n, v_fecha);
    end if;
  end loop;

  -- J: profilaxis terminadas y pacientes nuevos con cita de evaluación
  for k in 1 .. 15 loop
    i := i + 1;
    if k <= 10 then
      v_fecha := v_hoy - pg_temp.azar(10, 170);
      v_pac := pg_temp.paciente(i, 8, 70, v_fecha);
      v_plan := pg_temp.tratamiento(v_pac, c_mendoza, 8, v_fecha, v_fecha, 99);
      perform pg_temp.terminar(v_plan);
    else
      v_pac := pg_temp.paciente(i, 18, 60, v_hoy - pg_temp.azar(0, 5));
      perform pg_temp.cita(v_pac, c_mendoza, pg_temp.hora(v_hoy + pg_temp.azar(1, 14), pg_temp.azar(0, 18)),
        'programada', '{}', 'Evaluación (paciente nuevo)');
    end if;
  end loop;
end $$;
