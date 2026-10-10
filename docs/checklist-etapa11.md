# Checklist manual — Etapa 11 (exportar la historia clínica)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar la migración 0922 y de encender `HABILITAR_ETAPA11=1` en Vercel
(Preview), con las etapas 1 a 10 ya encendidas. Contraseña: `DemoTrujillo2026`.

- [ ] Odontóloga: en la ficha de un paciente con historia, odontograma, plan y evoluciones,
      botón **Exportar historia clínica**.
- [ ] Sin motivo no exporta. Con motivo, se abre el documento con encabezado (clínica,
      N° de historia, quién exportó, cuándo y el motivo).
- [ ] El documento trae: filiación; historia y todas sus versiones; odontogramas (dibujo y
      hallazgos); diagnósticos CIE-10 con adendas; planes con sus ítems; evoluciones
      firmadas con adendas; consentimientos; recetas. Lo anulado aparece marcado.
- [ ] «Imprimir o guardar como PDF»: el PDF sale en A4 sin los botones.
- [ ] La exportación aparece en «Exportaciones anteriores» con fecha, autor y motivo.
- [ ] Admin: en la auditoría aparece la acción «exportar» con el motivo.
- [ ] Abrir el enlace del documento con otro usuario (u horas después): «Esta exportación ya
      no está disponible» (hay que exportar de nuevo, con motivo).
- [ ] Asistente y recepción: no ven el botón; la dirección `/exportar` las devuelve a la ficha.
