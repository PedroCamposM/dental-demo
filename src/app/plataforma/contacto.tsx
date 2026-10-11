import { telefonoWhatsApp, type FilaCliente, type Salud } from "@/lib/gestion";

export const COLOR_SALUD: Record<Salud, string> = {
  verde: "bg-emerald-100 text-emerald-900", ambar: "bg-amber-100 text-amber-900", rojo: "bg-red-100 text-red-900",
  sin_datos: "bg-gray-100 text-gray-700",
};

/** Correo y WhatsApp del administrador de la clínica (si los hay). */
export function Contacto({ fila }: { fila: Pick<FilaCliente, "nombre" | "administrador" | "correo_admin" | "telefono"> }) {
  const tel = telefonoWhatsApp(fila.telefono);
  const saludo = `Hola${fila.administrador ? `, ${fila.administrador.split(",")[0]}` : ""}. Te escribo de Dental Demo sobre ${fila.nombre}.`;
  return (
    <span className="flex flex-wrap gap-2">
      {fila.correo_admin && (
        <a href={`mailto:${fila.correo_admin}?subject=${encodeURIComponent(`Dental Demo – ${fila.nombre}`)}`}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">Correo</a>
      )}
      {tel && (
        <a href={`https://wa.me/${tel}?text=${encodeURIComponent(saludo)}`} target="_blank" rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">WhatsApp</a>
      )}
      {!fila.correo_admin && !tel && <span className="text-xs text-gray-500">Sin contacto</span>}
    </span>
  );
}
