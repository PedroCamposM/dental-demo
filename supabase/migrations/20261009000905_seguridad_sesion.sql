-- Etapa 1 (v2): cierre de sesión por inactividad, configurable por clínica.
alter table public.clinica
  add column inactividad_minutos smallint not null default 15
    check (inactividad_minutos between 5 and 120);

-- Solo admin edita la clínica (política clinica_update); se le permite esta columna.
grant update (inactividad_minutos) on public.clinica to authenticated;
