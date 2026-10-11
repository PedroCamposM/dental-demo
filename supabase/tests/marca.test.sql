-- Etapa 15 (v2): personalización (logo, color, membrete). Solo el administrador la cambia;
-- cada clínica solo ve y sube el logo de su propia carpeta.
\ir _ayudantes.sql

select pruebas.como(null);
insert into auth.users (id) values
  ('c5000000-0000-0000-0000-00000000000a'), ('c5000000-0000-0000-0000-00000000000b'), ('d5000000-0000-0000-0000-00000000000a');
insert into public.clinica (id, nombre) values
  ('c5c5c5c5-0000-0000-0000-000000000000', 'Clínica Marca'), ('d5d5d5d5-0000-0000-0000-000000000000', 'Otra');
insert into public.usuario (id, clinica_id, nombre, rol, cop) values
  ('c5000000-0000-0000-0000-00000000000a', 'c5c5c5c5-0000-0000-0000-000000000000', 'Admin M', 'admin', null),
  ('c5000000-0000-0000-0000-00000000000b', 'c5c5c5c5-0000-0000-0000-000000000000', 'Dentista M', 'odontologo', '9811'),
  ('d5000000-0000-0000-0000-00000000000a', 'd5d5d5d5-0000-0000-0000-000000000000', 'Admin O', 'admin', null);

set role authenticated;
-- El administrador personaliza su clínica
select pruebas.como('c5000000-0000-0000-0000-00000000000a');
update public.clinica set color_marca = '#1d4ed8', direccion = 'Av. España 123, Trujillo', telefono = '044 123456',
       logo_ruta = 'c5c5c5c5-0000-0000-0000-000000000000/logo.png'
 where id = 'c5c5c5c5-0000-0000-0000-000000000000';
select pruebas.igual((select count(*) from public.clinica where color_marca = '#1d4ed8' and telefono = '044 123456'), 1,
                     'el admin guarda color y membrete');
select pruebas.debe_fallar($$update public.clinica set color_marca = 'azul' where id = 'c5c5c5c5-0000-0000-0000-000000000000'$$,
                           'check constraint');
select pruebas.debe_fallar($$update public.clinica set logo_ruta = 'd5d5d5d5-0000-0000-0000-000000000000/logo.png'
                             where id = 'c5c5c5c5-0000-0000-0000-000000000000'$$, 'clinica_logo_propio');
insert into storage.objects (bucket_id, name) values ('marca', 'c5c5c5c5-0000-0000-0000-000000000000/logo.png');
select pruebas.debe_fallar($$insert into storage.objects (bucket_id, name) values ('marca', 'd5d5d5d5-0000-0000-0000-000000000000/logo.png')$$,
                           'row-level security');
-- El odontólogo ve el logo pero no cambia la marca
select pruebas.como('c5000000-0000-0000-0000-00000000000b');
update public.clinica set color_marca = '#000000' where id = 'c5c5c5c5-0000-0000-0000-000000000000';
select pruebas.igual((select count(*) from public.clinica where color_marca = '#1d4ed8'), 1, 'el odontólogo no cambia el color');
select pruebas.igual((select count(*) from storage.objects where bucket_id = 'marca'), 1, 'el personal ve el logo');
select pruebas.debe_fallar($$insert into storage.objects (bucket_id, name) values ('marca', 'c5c5c5c5-0000-0000-0000-000000000000/otro.png')$$,
                           'row-level security');
-- Otra clínica no ve ni cambia nada
select pruebas.como('d5000000-0000-0000-0000-00000000000a');
select pruebas.igual((select count(*) from storage.objects where bucket_id = 'marca'), 0, 'otra clínica no ve el logo');
update public.clinica set color_marca = '#000000' where id = 'c5c5c5c5-0000-0000-0000-000000000000';
reset role;
select pruebas.igual((select count(*) from public.clinica where id = 'c5c5c5c5-0000-0000-0000-000000000000' and color_marca = '#1d4ed8'), 1,
                     'otra clínica no cambia el color');
select pruebas.como(null);
\echo 'marca: todas las aserciones pasaron'
