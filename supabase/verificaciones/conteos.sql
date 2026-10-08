-- Conteo por tabla del esquema public. El workflow de migración lo corre antes
-- y después de aplicar, para comparar. No modifica nada.
select json_object_agg(t.table_name, (xpath('/row/n/text()',
         query_to_xml(format('select count(*) as n from public.%I', t.table_name), false, true, '')))[1]::text::bigint
       order by t.table_name) as conteos
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE';
