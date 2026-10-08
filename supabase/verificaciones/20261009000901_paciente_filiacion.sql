-- Verifica la migración de datos de la filiación. Lanza excepción si algo no cuadra.
do $$
declare v bigint;
begin
  select count(*) into v from public.paciente where dni is not null and numero_documento is distinct from dni;
  if v > 0 then raise exception 'filiación: % pacientes con dni distinto de numero_documento', v; end if;

  select count(*) into v from public.paciente where tipo_documento = 'dni' and numero_documento is not null and dni is null;
  if v > 0 then raise exception 'filiación: % pacientes tipo dni sin dni sincronizado', v; end if;

  select count(*) into v from (select 1 from public.paciente where numero_documento is not null
                               group by clinica_id, tipo_documento, numero_documento having count(*) > 1) d;
  if v > 0 then raise exception 'filiación: % documentos repetidos', v; end if;

  select count(*) into v from public.paciente p where not exists (select 1 from public.clinica c where c.id = p.clinica_id);
  if v > 0 then raise exception 'filiación: % pacientes huérfanos', v; end if;
end $$;
select count(*) as pacientes, count(numero_documento) as con_documento from public.paciente;
