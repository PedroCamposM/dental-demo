# Checklist manual — Etapa 9 (periodontograma y registros por especialidad)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar las migraciones 0919 y 0920 y de encender `HABILITAR_ETAPA9=1` en
Vercel (Preview), con las etapas 1 a 8 ya encendidas. Contraseña: `DemoTrujillo2026`.
Usa solo datos inventados.

**A validar con la clínica piloto (regla 10):** la convención del margen gingival (MG
positivo = recesión; NIC = PS + MG), los grados 0–3 de movilidad y furca (sin fijar
clasificación), los nombres de las fases del implante y el uso de la escala de Frankl.

## Periodontograma

- [ ] Odontóloga: pestaña **Periodontograma** → «Nuevo periodontograma». La grilla muestra
      arcada superior e inferior, caras vestibular y palatina/lingual, tres sitios por cara.
- [ ] Escribir PS y MG (MG puede ser negativo): el NIC se calcula al instante. PS ≥ 4 mm
      se resalta en ámbar y ≥ 6 mm en rojo. Marcar sangrado, placa y supuración.
- [ ] Movilidad y furca (furca solo en molares y primeros premolares superiores).
- [ ] Marcar una pieza como **ausente**: sus casillas se deshabilitan.
- [ ] Un valor fuera de rango (p. ej. PS 25) → mensaje con la pieza; lo escrito no se pierde.
- [ ] Vaciar una pieza ya guardada y guardar: al recargar, queda vacía.
- [ ] «Guardar y firmar» con mantenimiento a 3 meses → «Firmado. Mantenimiento programado…»;
      queda en solo lectura. En el Tablero de gestión/clínico aparecerá el mantenimiento al vencer.
- [ ] Asistente: «Nuevo periodontograma» pide el cirujano dentista responsable; lo registra
      y guarda, pero **no** ve «Guardar y firmar». Tampoco puede anular uno firmado.
- [ ] El responsable abre ese borrador y lo firma.
- [ ] Con dos firmados: «Comparar fechas» lista los sitios que cambiaron 2 mm o más.
- [ ] Cambiar de un borrador a otro en la lista: la grilla muestra los datos del elegido.
- [ ] Anular un firmado (solo su responsable) con motivo: queda «Anulado: …».
- [ ] Recepción: no ve la pestaña; la dirección la devuelve a la ficha.

## Registros por especialidad (en la evolución)

- [ ] Odontóloga: plan aceptado con una endodoncia y una exodoncia. Evolución en borrador:
      marcar ambos como trabajados y **guardar el borrador**. Aparecen «Endodoncia (conducto)»
      y «Cirugía» para cada ítem.
- [ ] Endodoncia: conducto, longitud de trabajo (5–40 mm, un decimal), referencia, lima
      maestra, irrigación y obturación. Registrar dos conductos (MV, DV).
- [ ] Cirugía: técnica, sutura y retiro de puntos a los 7 días. Sin sutura, no deja indicar
      retiro de puntos.
- [ ] En borrador, «Anular» un registro con motivo. Firmar la evolución: los registros quedan
      fijos (sin «Anular»). Al firmar se crea el control de retiro de puntos a los 7 días.
- [ ] Ortodoncia: ítem de ortodoncia trabajado → «Diagnóstico ortodóncico» (una vez) y
      «Control de ortodoncia» en cada sesión.
- [ ] Implante: marca, diámetro, longitud, lote y torque; la pieza es la del ítem. En una
      sesión posterior aparece «Fase del implante en …» (oseointegración, segunda fase,
      protésica, en carga). La fecha no puede ser futura.
- [ ] Paciente menor de edad: aparece «Odontopediatría» (apoderado presente y conducta).
- [ ] Anular una evolución en borrador con registros: los registros quedan anulados con ella.
- [ ] Pestaña **Especialidades**: conductos con sus sesiones, ortodoncia con sus controles,
      implantes con su fase y fecha de carga, cirugías y odontopediatría.
- [ ] Asistente: ve la pestaña Especialidades y los registros, pero no los escribe.
- [ ] Recepción: no ve la pestaña ni los registros.
