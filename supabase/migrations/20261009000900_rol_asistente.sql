-- Etapa 1 (v2): rol asistente. Va solo en su migración: Postgres no permite usar
-- un valor nuevo de un enum en la misma transacción que lo crea.
alter type public.rol_usuario add value if not exists 'asistente';
