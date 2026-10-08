-- Ayudantes de las pruebas SQL. Cada *.test.sql lo incluye con \ir.
-- Cada aserción lanza una excepción si falla (ON_ERROR_STOP detiene todo).

create schema if not exists pruebas;
grant usage on schema pruebas to anon, authenticated;

-- Ejecuta sql y exige que falle con un mensaje que contenga patron.
-- (El error esperado se captura en un bloque interno: si el SQL no falla, la
-- excepción "se esperaba un error" se lanza FUERA de ese bloque y no se confunde
-- con el error buscado.)
create or replace function pruebas.debe_fallar(sql text, patron text) returns void
language plpgsql as $$
declare
  fallo boolean := false;
  mensaje text;
begin
  begin
    execute sql;
  exception when others then
    fallo := true;
    mensaje := sqlerrm;
  end;
  if not fallo then
    raise exception 'Se esperaba un error que contenga «%» y no hubo error: %', patron, sql;
  end if;
  if mensaje not ilike '%' || patron || '%' then
    raise exception 'Error inesperado en "%": % (se esperaba «%»)', sql, mensaje, patron;
  end if;
end $$;

create or replace function pruebas.igual(obtenido bigint, esperado bigint, que text) returns void
language plpgsql as $$
begin
  if obtenido is distinct from esperado then
    raise exception '%: se obtuvo %, se esperaba %', que, obtenido, esperado;
  end if;
end $$;

-- Actúa como ese usuario (auth.uid()). null = sin usuario (sistema).
create or replace function pruebas.como(usuario uuid) returns void
language sql as $$ select set_config('request.jwt.claim.sub', coalesce(usuario::text, ''), false) $$;

grant execute on all functions in schema pruebas to anon, authenticated;
