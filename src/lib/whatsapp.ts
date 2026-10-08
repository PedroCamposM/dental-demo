// Mensajes de WhatsApp por enlace wa.me (sin la API de Meta en la demo).

/** Reemplaza {{variable}}. Las variables desconocidas quedan a la vista para corregir la plantilla. */
export function rellenarPlantilla(cuerpo: string, variables: Record<string, string>): string {
  return cuerpo.replace(/\{\{\s*(\w+)\s*\}\}/g, (original, nombre: string) => variables[nombre] ?? original);
}

/** Enlace wa.me con el mensaje pre-llenado. El teléfono va sin "+" (51 + 9 dígitos). */
export function enlaceWhatsApp(telefono: string, texto: string): string {
  const numero = telefono.replace(/\D/g, "");
  if (!/^51\d{9}$/.test(numero)) {
    throw new Error(`Teléfono peruano inválido: ${telefono}`);
  }
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
