# Checklist manual — Etapa 3 (historia clínica, signos vitales y alertas)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de correr «Aplicar migraciones» (0906–0909), cargar `seed_etapa2.sql` y
`seed_etapa3.sql`, y encender `HABILITAR_ETAPA3=1` en Vercel (Preview).
Contraseña: `DemoTrujillo2026`. Usa solo datos inventados.

## Odontóloga (`mendoza`)

- [ ] Abrir un paciente: arriba dice «Historia clínica N° … (DNI)» y hay tres pestañas:
      Filiación · Historia clínica · Signos vitales.
- [ ] El banner de alertas aparece en las tres pestañas, con la fecha de la historia.
      Buscar un paciente alérgico a la penicilina y uno anticoagulado (el seed los trae).
- [ ] **Historia clínica**: se ven la anamnesis (motivo, tiempo de enfermedad, forma de
      inicio, relato y funciones biológicas), los antecedentes médicos y familiares, y
      quién la registró con su COP.
- [ ] «Actualizar historia»: el motivo y la enfermedad actual empiezan vacíos; alergias,
      enfermedades y antecedentes vienen de la versión anterior.
- [ ] Marcar «Toma anticoagulantes» sin decir cuál: error claro y no se pierde lo escrito.
- [ ] Guardar: «Historia guardada como versión N». En «Versiones» se puede abrir la anterior,
      que no cambió.
- [ ] Paciente varón o niño: no aparece la pregunta de embarazo.
- [ ] **Signos vitales**: registrar presión, temperatura con coma (36,6), peso y talla; se
      calcula el IMC. Anular uno con motivo: queda tachado con el motivo, no se borra.

## Asistente (`asistente`)

- [ ] Ve la historia y los signos, y puede registrar ambos.
- [ ] No ve Gestión ni Configuración.

## Recepción (`recepcion`)

- [ ] En la ficha **no** aparecen las pestañas Historia clínica ni Signos vitales; si
      escribe la dirección `/pacientes/<id>/historia`, vuelve a la ficha.
- [ ] Sí ve el banner de alertas. Si el paciente tiene una enfermedad registrada, ve
      «Condición sistémica registrada (detalle en la historia clínica)», sin el nombre.
- [ ] En la agenda, la cita del paciente alérgico muestra la alerta, también al pasar el
      cursor.
- [ ] **Filiación (NTS 139)**: «Editar filiación» muestra lugar de nacimiento, domicilio
      de procedencia, grupo sanguíneo y Rh, estado civil, grado de instrucción, seguro y
      religión, todos opcionales. Al elegir un seguro distinto de «Ninguno» aparece
      «N° de afiliación». Guardar y ver los datos en la ficha.

## Administrador (`valverde`)

- [ ] Fusionar dos registros del mismo paciente (crear uno de prueba con el mismo nombre
      y fecha): la historia del duplicado pasa como versiones nuevas y se crea una
      «versión conciliada» con todas las alergias de ambos.
- [ ] (Sin pantalla aún) Las lecturas de la historia quedan en la tabla `auditoria`; Claude
      lo verifica en la base.

## En todos los roles

- [ ] Ninguna pantalla en blanco ni mensajes técnicos; en tablet, los formularios se
      leen y se tocan bien.
