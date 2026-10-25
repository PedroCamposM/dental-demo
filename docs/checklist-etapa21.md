# Checklist manual — Etapa 21 (ficha en una página, plan por zona y varios diagnósticos)

Se prueba después de aplicar la migración 0935 (lo hago yo con tu OK, antes de fusionar).
No hay bandera nueva: lo cambiado está detrás de las mismas banderas de antes.

Conviene hacerlo **en la tablet**, con el odontólogo piloto si puede, y con un paciente nuevo.

## Atención rápida = ficha en una página (odontólogo)
- [ ] Desde la ficha del paciente, «Atención rápida» abre una sola página con, en orden:
      datos del paciente, anamnesis, odontograma, diagnósticos, plan y ficha de control.
- [ ] Datos del paciente: edad, sexo, documento, nacimiento, dirección y celular.
      «Más datos» muestra estado civil, ocupación, instrucción, procedencia y contacto de emergencia.
      «Editar datos» lleva a la filiación.
- [ ] Anamnesis:
  - [ ] guardar sin motivo de consulta avisa;
  - [ ] guardar sin alergias y sin marcar «Ninguna conocida» avisa;
  - [ ] escribir una alergia y marcar «Ninguna conocida» a la vez avisa;
  - [ ] guardar con «Penicilina»: aparece el banner de alerta, sin salir de la página;
  - [ ] en Historia clínica se ve la versión nueva, y lo que la ficha no pregunta
        (cirugías, hábitos, etc.) sigue igual que en la versión anterior.
- [ ] Odontograma:
  - [ ] «Empezar odontograma» con dentición y especificaciones lo crea ahí mismo;
  - [ ] se marcan hallazgos sin salir de la página;
  - [ ] las especificaciones se ven debajo (no se editan después).
- [ ] Diagnósticos y plan: se agregan sin salir de la página (ver abajo).
- [ ] Ficha de control:
  - [ ] «Registrar labor de hoy» abre la evolución ahí mismo;
  - [ ] al firmar, aparece una fila con fecha, labor y profesional.
- [ ] Al pie, «Más de la historia» lleva a las secciones completas (examen, periodontograma, recetas…).
- [ ] Como **asistente** o **recepción**: no se puede registrar nada en la ficha (mensaje claro, sin pantalla rota).

## Varios diagnósticos CIE-10 a la vez (odontólogo)
- [ ] En Examen o en la ficha: buscar K02.1, «Agregar código»; luego K04.0, «Agregar código».
- [ ] Piezas «36, 46»: «Registrar» crea 4 diagnósticos («4 diagnósticos registrados (K02.1, K04.0).»).
- [ ] Con superficies y más de una pieza, avisa.
- [ ] Sin piezas, crea un diagnóstico por código (general).
- [ ] Convertir un hallazgo del odontograma en diagnóstico sigue funcionando como antes (un código).

## Plan por zona (admin y odontólogo)
- [ ] Admin, Configuración → Procedimientos: cada procedimiento tiene «Se cotiza» (por pieza,
      cuadrante, arcada o boca completa). Profilaxis y destartraje ya vienen «por boca completa».
- [ ] Odontólogo, en el plan: elegir «Profilaxis y destartraje» marca sola la zona «Ambas arcadas».
- [ ] Cambiar a «Arcada superior»: el precio sugerido es el de una arcada.
- [ ] Con piezas y zona a la vez, avisa.
- [ ] El ítem se ve como «Arcada superior» (no «pieza —») en el plan, evolución, consentimientos,
      laboratorio, especialidades y en el PDF de la historia.
- [ ] Copiar un plan (versión nueva) conserva la zona.
- [ ] Los ítems por pieza siguen igual que antes.

## Nada roto
- [ ] Planes, diagnósticos y evoluciones existentes se ven igual que antes.
- [ ] Recepción sigue viendo el plan y los pagos, sin notas clínicas.
