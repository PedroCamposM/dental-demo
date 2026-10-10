-- Corre las fechas de la clínica de demostración al día de hoy (migración 0923).
select privado.refrescar_fechas_demo('c0000000-0000-4000-8000-000000000001') as resultado;
