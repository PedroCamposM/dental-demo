-- Seguimiento de inasistencias: el tablero muestra el no-show del mes y cada
-- número del tablero debe permitir enviar un mensaje que quede registrado.
-- Solo agrega un valor al enum; la plantilla de cada clínica es un dato.
alter type public.tipo_seguimiento add value if not exists 'no_show';
