-- Etapa 13 (v2): el certificado de descanso (y, si se quiere, la constancia de atención)
-- menciona el tratamiento realizado, que es parte del porqué del descanso.
--
-- Aditiva: una columna opcional. La obligación en el certificado de descanso se exige en
-- la base solo para los documentos nuevos (los emitidos antes quedan como estaban).

alter table public.constancia
  add column tratamiento text check (char_length(tratamiento) <= 500);

-- Los certificados de descanso nuevos llevan el tratamiento realizado.
create function privado.constancia_con_tratamiento() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tipo = 'descanso' and coalesce(btrim(new.tratamiento), '') = '' then
    raise exception 'El certificado de descanso indica el tratamiento realizado';
  end if;
  new.tratamiento := nullif(btrim(new.tratamiento), '');
  return new;
end $$;
-- «preparar_tratamiento» corre después de «preparar» (orden alfabético de los triggers).
create trigger preparar_tratamiento before insert on public.constancia
  for each row execute function privado.constancia_con_tratamiento();

grant insert (tratamiento) on public.constancia to authenticated;
