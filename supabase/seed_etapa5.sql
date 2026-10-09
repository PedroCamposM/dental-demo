-- Complemento del seed para la Etapa 5 (v2): plan con fases, versiones y alternativas.
--
-- Idempotente. El seed v1 crea las alternativas B como planes sueltos; aquí se unen
-- al plan A del mismo paciente presentado el mismo día (la migración 0911 hace lo
-- mismo con los datos que ya existían en el remoto).
update public.plan_tratamiento b set grupo_id = a.id
from public.plan_tratamiento a
where b.clinica_id = 'c0000000-0000-4000-8000-000000000001'
  and b.alternativa <> 'A' and a.alternativa = 'A' and a.paciente_id = b.paciente_id and a.id <> b.id
  and b.grupo_id = b.id
  and (a.presentado_at at time zone 'America/Lima')::date = (b.presentado_at at time zone 'America/Lima')::date;
