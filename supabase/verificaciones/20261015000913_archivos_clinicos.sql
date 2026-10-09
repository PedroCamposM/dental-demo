-- Verificación de 0913: el bucket clínico existe y es privado (sin migración de datos).
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'clinico' and not public) then
    raise exception 'El bucket clinico no existe o es público';
  end if;
end $$;
