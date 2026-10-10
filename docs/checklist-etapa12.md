# Checklist manual — Etapa 12 (seed ampliado, guion de la demo y fechas al día)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar la migración 0923 y cargar `seed_etapa12.sql`, con las etapas 1 a 11
encendidas. Contraseña: `DemoTrujillo2026`. Seguir `docs/guion-demo.md` de principio a fin.

## Datos de la demo (Dra. Mendoza)

- [ ] Diana Zavaleta Cerna: banner «Alergia: Penicilina» en la ficha, el plan y la agenda.
- [ ] Jimena Horna Cerna: banner «Anticoagulado: Warfarina 5 mg diaria».
- [ ] Mateo Otiniano Paredes → Especialidades → Ortodoncia: caso con «Controles (5)», uno por mes.
- [ ] Diana Lescano Torres → Especialidades → Implantes: «Fase protésica», con sus fases anteriores.
- [ ] Una endodoncia realizada tiene sus conductos en Especialidades → Endodoncia, y el
      paciente tiene la corona en el plan.
- [ ] Víctor Ramírez Burgos: ficha con Apoderado; Especialidades → Odontopediatría con conducta.
- [ ] Tablero clínico → Controles vencidos: «Retiro de puntos» de Ricardo Benites Neyra.
- [ ] Tablero clínico → Laboratorio: corona de Ana Castillo Neyra atrasada.
- [ ] Lucía Lescano Silva → Periodontograma: dos firmados; «Comparar» muestra los cambios.
- [ ] Siguen los casos de gestión: presupuestos abiertos, cuotas vencidas y tratamientos detenidos.

## Flujo completo (los cuatro roles)

- [ ] Recepción da de alta un paciente nuevo; no ve las pestañas clínicas.
- [ ] Odontóloga: historia (con una alergia → banner), odontograma, diagnóstico desde el
      hallazgo, plan desde el diagnóstico, aceptación.
- [ ] Cita (fuera de horario solo la fuerza la admin, con motivo) → Atender → evolución
      firmada → ítem realizado y plan terminado.
- [ ] Recepción cobra; la ficha muestra **Controles programados** con el control.
- [ ] Asistente: registra signos vitales; no firma ni exporta.

## Fechas al día

- [ ] GitHub → Actions → «Refrescar fechas de la demo» → escribir `REFRESCAR`: termina en
      verde e informa cuántos días movió. Si se corre dos veces el mismo día, mueve 0 días.
- [ ] Después de refrescar: las citas de hoy siguen siendo de hoy y la auditoría no cambió.
