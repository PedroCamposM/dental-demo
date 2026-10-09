# Checklist manual — Etapa 4 (examen clínico, odontograma y diagnóstico CIE-10)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar la migración 0910, cargar `seed_etapa4.sql` y encender
`HABILITAR_ETAPA4=1` en Vercel (Preview). Contraseña: `DemoTrujillo2026`.
Usa solo datos inventados.

## Odontóloga (`mendoza`)

- [ ] Un paciente del seed: la pestaña **Odontograma** muestra el gráfico de la norma
      (cuatro filas: permanentes y temporales, superiores e inferiores) con sus
      hallazgos en azul o rojo y las siglas en los recuadros.
- [ ] **Confirmar la convención de superficies:** en una pieza superior, ¿la zona de
      arriba (hacia la raíz) es vestibular? ¿mesial es el lado hacia la línea media?
      Si la clínica usa otra, avisar a Claude.
- [ ] Paciente nuevo: «Crear odontograma» (inicial). Tocar la pieza 36, elegir
      «Lesión de caries dental», marcar Oclusal y la sigla CD: la cara se pinta de rojo.
- [ ] Diastema entre 11 y 13: «Las piezas deben ser vecinas».
- [ ] Una corona en buen estado (azul) y otra en mal estado (rojo).
- [ ] «Registrar diagnóstico» desde la caries: el formulario llega con la pieza y la
      superficie. Elegir K02.1 en el buscador (escribir «caries» o «K02»).
- [ ] Escribir solo «K02»: pide el subcódigo.
- [ ] Un diagnóstico presuntivo → «Confirmar como definitivo». Agregar una adenda.
      Anular otro con motivo: queda tachado con el motivo.
- [ ] Registrar un examen clínico (extraoral e intraoral, higiene).
- [ ] «Nuevo odontograma» de evolución: parte de los hallazgos del anterior. Anular en
      el nuevo una caries «restaurada»; el inicial sigue igual («Ver» en el historial).

## Asistente (`asistente`)

- [ ] Ve el odontograma, los diagnósticos y los exámenes, pero no hay botones para
      registrar ni anular.

## Recepción (`recepcion`)

- [ ] No ve las pestañas Odontograma ni Examen y diagnóstico; si escribe la dirección,
      vuelve a la ficha.

## Administrador (`valverde`, con COP)

- [ ] Puede registrar como cirujano dentista. Solo agrega hallazgos a los odontogramas
      que él firmó (los de otro odontólogo se ven, pero se registra uno de evolución).

## En todos los roles

- [ ] En tablet el odontograma se puede desplazar de lado y las piezas se tocan bien.
- [ ] Ninguna pantalla en blanco ni mensajes técnicos.
