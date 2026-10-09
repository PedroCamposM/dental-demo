-- Verifica la migración de datos de la 0911 (grupo de versiones y alternativas).
do $$
declare v bigint;
begin
  select count(*) into v from public.plan_tratamiento where grupo_id is null;
  if v > 0 then raise exception '0911: % planes sin grupo', v; end if;

  -- El grupo es un plan del mismo paciente.
  select count(*) into v from public.plan_tratamiento p
   where not exists (select 1 from public.plan_tratamiento g where g.id = p.grupo_id and g.paciente_id = p.paciente_id);
  if v > 0 then raise exception '0911: % planes con grupo huérfano o de otro paciente', v; end if;

  -- Cada alternativa B, C… quedó junto a una alternativa A.
  select count(*) into v from public.plan_tratamiento p
   where p.alternativa <> 'A'
     and not exists (select 1 from public.plan_tratamiento a where a.grupo_id = p.grupo_id and a.alternativa = 'A');
  if v > 0 then raise exception '0911: % alternativas sin su plan A', v; end if;

  -- Ningún ítem quedó en una fase que no existe en su plan.
  select count(*) into v from public.item_plan i
   where exists (select 1 from public.plan_fase f where f.plan_id = i.plan_id)
     and not exists (select 1 from public.plan_fase f where f.plan_id = i.plan_id and f.numero = i.fase);
  if v > 0 then raise exception '0911: % ítems en fases inexistentes', v; end if;
end $$;
select alternativa, count(*) as planes, count(distinct grupo_id) as grupos from public.plan_tratamiento group by alternativa order by 1;
