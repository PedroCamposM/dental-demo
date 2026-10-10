-- Verifica la migración de datos de la 0910 (dentición del odontograma y CIE-10).
do $$
declare v bigint;
begin
  select count(*) into v from public.odontograma where denticion is null;
  if v > 0 then raise exception '0910: % odontogramas sin dentición', v; end if;

  -- Un odontograma con piezas temporales no puede quedar como «permanente».
  select count(*) into v from public.odontograma o
   where o.denticion = 'permanente'
     and exists (select 1 from public.odontograma_hallazgo h where h.odontograma_id = o.id and h.pieza / 10 between 5 and 8);
  if v > 0 then raise exception '0910: % odontogramas permanentes con piezas temporales', v; end if;

  -- Todos los CIE-10 ya usados en hallazgos y notas existen en el catálogo.
  select count(*) into v from (
    select cie10 from public.odontograma_hallazgo where cie10 is not null
    union select cie10 from public.nota_evolucion where cie10 is not null) u
   where not exists (select 1 from public.catalogo_cie10 c where c.codigo = u.cie10);
  if v > 0 then raise exception '0910: % códigos CIE-10 en uso que no están en el catálogo', v; end if;
end $$;
select denticion, count(*) from public.odontograma group by denticion order by 1;
