-- Complemento del seed para la Etapa 1 (v2): asistente y filiación completa.
--
-- Idempotente: se puede correr varias veces sin duplicar nada y sin borrar datos.
-- Local/CI: `supabase db reset` lo carga después de seed.sql (config.toml).
-- Remoto: se aplica una vez sobre la clínica demo existente.
-- Todo es ficticio. Los valores se derivan del id del paciente (md5), así que
-- salen iguales en cada carga.

-- ---------------------------------------------------------------------------
-- Asistente dental (contraseña de demo: DemoTrujillo2026)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000005', 'authenticated',
       'authenticated', 'asistente@clinica-demo.example',
       extensions.crypt('DemoTrujillo2026', extensions.gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}', '{"nombre": "Milagros Ruiz Arana"}',
       now(), now(), '', '', '', ''
where exists (select 1 from public.clinica where id = 'c0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id = 'd0000000-0000-4000-8000-000000000005'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into public.usuario (id, clinica_id, nombre, rol)
select 'd0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Milagros Ruiz Arana', 'asistente'
where exists (select 1 from auth.users where id = 'd0000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Filiación de los pacientes demo (solo donde falta)
-- ---------------------------------------------------------------------------
create function pg_temp.elegir_por(clave text, opciones text[]) returns text
language sql immutable as $$
  select opciones[1 + (('x' || substr(md5(clave), 1, 7))::bit(28)::int % cardinality(opciones))::int]
$$;

update public.paciente p set
  sexo = case when split_part(p.nombres, ' ', 1) = any (array['María','Rosa','Carmen','Ana','Lucía','Sofía','Valeria',
           'Camila','Andrea','Fiorella','Milagros','Jimena','Patricia','Gabriela','Elena','Diana','Karla','Mariela',
           'Yesenia','Ximena','Daniela','Gloria'])
         then 'femenino' else 'masculino' end::public.sexo,
  ocupacion = case
    when p.fecha_nacimiento > (current_date - interval '18 years') then 'Estudiante'
    else pg_temp.elegir_por(p.id::text || 'o', array['Docente','Comerciante','Ingeniero(a)','Contador(a)','Enfermero(a)',
           'Abogado(a)','Administrador(a)','Estudiante universitario','Ama de casa','Agricultor','Chofer','Jubilado(a)',
           'Técnico(a) en computación','Secretario(a)','Independiente'])
    end,
  direccion = pg_temp.elegir_por(p.id::text || 'c', array['Av. España','Av. América Sur','Jr. Pizarro','Av. Larco',
           'Calle Los Pinos','Jr. Gamarra','Av. Húsares de Junín','Calle San Martín','Av. Mansiche','Jr. Bolívar'])
    || ' ' || (100 + ('x' || substr(md5(p.id::text || 'n'), 1, 4))::bit(16)::int % 1800)::text || ', '
    || pg_temp.elegir_por(p.id::text || 'd', array['Trujillo','Víctor Larco Herrera','La Esperanza','El Porvenir',
           'Huanchaco','Florencia de Mora']),
  contacto_emergencia_nombre = case when p.apoderado_nombre is null
    then pg_temp.elegir_por(p.id::text || 'e', array['Jorge','Rosa','Luis','Carmen','Miguel','Patricia','Juan','Elena'])
         || ' ' || split_part(p.apellidos, ' ', 1) end,
  contacto_emergencia_telefono = case when p.apoderado_nombre is null
    then '519' || lpad((('x' || substr(md5(p.id::text || 't'), 1, 7))::bit(28)::int % 100000000)::text, 8, '0') end,
  contacto_emergencia_parentesco = case when p.apoderado_nombre is null
    then pg_temp.elegir_por(p.id::text || 'p', array['cónyuge','hijo(a)','hermano(a)','madre','padre']) end,
  apoderado_parentesco = case when p.apoderado_nombre is not null
    then case when split_part(p.apoderado_nombre, ' ', 1) = any (array['María','Rosa','Carmen','Ana','Patricia'])
              then 'madre' else 'padre' end end
where p.clinica_id = 'c0000000-0000-4000-8000-000000000001' and p.sexo is null;
