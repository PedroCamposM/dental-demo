-- Etapa 15 (v2): personalización de la clínica (logo, color y membrete de los documentos).
--
-- Aditiva: columnas opcionales en clinica (sin datos, todo se ve como hasta ahora) y un
-- bucket privado `marca` para el logo. Solo el administrador los cambia (la política de
-- update de clinica ya lo exige; aquí se dan los grants por columna y las del bucket).

alter table public.clinica
  add column logo_ruta      text,
  add column color_marca    text check (color_marca ~ '^#[0-9a-f]{6}$'),
  add column direccion      text check (char_length(direccion) <= 200),
  add column telefono       text check (char_length(telefono) <= 40),
  add column correo         text check (char_length(correo) <= 120),
  add column pie_documentos text check (char_length(pie_documentos) <= 300),
  -- El logo vive en la carpeta de la propia clínica dentro del bucket.
  add constraint clinica_logo_propio check (logo_ruta is null or logo_ruta like id::text || '/%');

grant update (logo_ruta, color_marca, direccion, telefono, correo, pie_documentos) on public.clinica to authenticated;

-- Bucket privado: el logo se muestra con URL firmada (como las imágenes clínicas).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marca', 'marca', false, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Todo el personal de la clínica ve su logo; solo el administrador lo sube o reemplaza.
create policy marca_select on storage.objects for select to authenticated
  using (bucket_id = 'marca' and (storage.foldername(name))[1] = (select privado.clinica_actual())::text);
create policy marca_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'marca' and (storage.foldername(name))[1] = (select privado.clinica_actual())::text
              and (select privado.rol_actual()) = 'admin');
create policy marca_update on storage.objects for update to authenticated
  using (bucket_id = 'marca' and (storage.foldername(name))[1] = (select privado.clinica_actual())::text
         and (select privado.rol_actual()) = 'admin');
create policy marca_delete on storage.objects for delete to authenticated
  using (bucket_id = 'marca' and (storage.foldername(name))[1] = (select privado.clinica_actual())::text
         and (select privado.rol_actual()) = 'admin');
