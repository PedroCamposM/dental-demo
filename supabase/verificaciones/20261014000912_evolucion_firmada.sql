-- Verifica la migración de datos de la 0912 (notas de la v1 firmadas; regla 3).
do $$
declare v bigint;
begin
  -- Todo ítem realizado tiene su evolución firmada y vigente.
  select count(*) into v from public.item_plan i
   where i.estado = 'realizado'
     and not exists (select 1 from public.nota_evolucion n where n.id = i.nota_evolucion_id
                       and n.firmada_at is not null and n.anulado_at is null);
  if v > 0 then raise exception '0912: % ítems realizados sin evolución firmada', v; end if;

  -- Ninguna nota quedó con texto vacío y firmada.
  select count(*) into v from public.nota_evolucion where firmada_at is not null and char_length(btrim(texto)) < 3;
  if v > 0 then raise exception '0912: % evoluciones firmadas sin texto', v; end if;

  -- Ninguna evolución apunta a una cita de otro paciente.
  select count(*) into v from public.nota_evolucion n join public.cita c on c.id = n.cita_id
   where c.paciente_id <> n.paciente_id;
  if v > 0 then raise exception '0912: % evoluciones con cita de otro paciente', v; end if;
end $$;
select count(*) as evoluciones, count(firmada_at) as firmadas from public.nota_evolucion;
