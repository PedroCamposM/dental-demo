# Checklist manual — Etapa 7 (imágenes, consentimientos, recetas, constancias e interconsultas)

Se prueba en la vista previa de Vercel de la rama `claude/affectionate-maxwell-bjl90k`,
**después** de aplicar las migraciones 0913 a 0916, cargar `seed_etapa7.sql` y encender
`HABILITAR_ETAPA7=1` en Vercel (Preview), con las etapas 1 a 6 ya encendidas.
Contraseña: `DemoTrujillo2026`. Usa solo datos e imágenes inventados.

## Imágenes y archivos

- [ ] Asistente: en un paciente, pestaña **Imágenes y archivos**, subir una foto o PDF
      (tipo, fecha, pieza y sesión opcionales). Aparece con «Solo uso clínico».
- [ ] Un archivo .txt o de más de 10 MB: aviso antes de subir.
- [ ] El enlace de la imagen vence a los 5 minutos (al recargar se renueva).
- [ ] Odontóloga: **Anular** con motivo; queda tachado con el motivo. El escaneo de un
      consentimiento no se puede anular desde aquí.
- [ ] Recepción: no ve la pestaña; abrir la dirección a mano la devuelve a la ficha.

## Consentimientos (firma a mano, NTS 139)

- [ ] Admin: **Configuración → Consentimientos** muestra las plantillas de ejemplo
      marcadas «Ejemplo sin revisar». Editar una y marcar «La clínica revisó…».
- [ ] Admin: en un procedimiento del catálogo, elegir su plantilla de consentimiento.
- [ ] Odontóloga: paciente con un plan aceptado que incluya una exodoncia. Pestaña
      **Consentimientos**: aparece en «Requieren consentimiento…». **Generar formato** usa
      la plantilla del catálogo.
- [ ] **Imprimir formato**: IPRESS, N° de historia, fecha y hora, paciente, procedimiento,
      descripción, riesgos, efectos adversos, pronóstico, profesional con COP, conformidad,
      negativa y revocación con firma y huella. Si la plantilla es de ejemplo, lo avisa.
- [ ] Menor de edad: el formato lo firma su apoderado (nombre y DNI del apoderado).
- [ ] Evolución: marcar la exodoncia como terminada y firmar → no firma («requiere el
      consentimiento informado firmado»), el borrador queda guardado.
- [ ] Asistente: **Subir formato firmado** (foto o PDF) → queda «Firmado» con «Ver formato
      firmado». Ahora la evolución se firma y la exodoncia queda realizada.
- [ ] Negativa: registrar «Se negó» con su escaneo. Revocar un firmado con motivo.
- [ ] Hacer una versión nueva del plan: el ítem conserva el consentimiento ya firmado.
- [ ] Uso de imagen: generar con fines (académicos, difusión), subir firmado → en Imágenes
      aparece «Uso autorizado».

## Recetas y documentos

- [ ] Odontóloga: **Nueva receta** con dos medicamentos (medicamento, presentación, dosis,
      frecuencia y duración, escritos por ella). Una fila incompleta: pide completarla.
      Nada se sugiere.
- [ ] «Guardar también como plantilla»: la siguiente receta puede partir de ella. Otro
      profesional no ve esa plantilla.
- [ ] **Imprimir receta**: datos del profesional y COP, «Rp.» y la lista.
- [ ] Constancia de atención y certificado de descanso (1 a 30 días, diagnóstico CIE-10
      opcional); imprimir. Anular con motivo.
- [ ] Asistente: ve recetas y documentos, no emite. Recepción: no ve la pestaña.

## Interconsultas

- [ ] Odontóloga: **interna** a la Dra. Valverde. Valverde la ve en **Pacientes →
      Interconsultas por responder** y responde.
- [ ] **Externa** a Cardiología con datos clínicos; imprimirla (incluye las alertas
      registradas y espacio para la respuesta). La asistente registra el resultado y adjunta
      el documento.
- [ ] Cancelar una pendiente (solo quien la pidió). Recepción no ve la pestaña.

## En todos los roles

- [ ] Fusionar dos pacientes (admin) mueve imágenes, consentimientos, recetas, constancias
      e interconsultas.
- [ ] Ninguna pantalla en blanco ni mensajes técnicos.
