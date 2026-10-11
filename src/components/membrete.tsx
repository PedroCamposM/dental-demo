import { membreteClinica } from "@/lib/marca-servidor";

/** Cabecera de los documentos impresos: logo, nombre, RUC y datos de contacto de la clínica. */
export async function MembreteClinica({ clinicaId }: { clinicaId: string }) {
  const m = await membreteClinica(clinicaId);
  const contacto = [m.direccion, m.telefono && `Tel. ${m.telefono}`, m.correo].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de corta duración: next/image no aplica */}
      {m.logo && <img src={m.logo} alt={`Logo de ${m.nombre}`} className="max-h-[18mm] max-w-[40mm] object-contain" />}
      <div>
        <p className="text-[12pt] font-bold">{m.nombre}</p>
        {m.ruc && <p className="text-[9pt]">RUC {m.ruc}</p>}
        {contacto && <p className="text-[9pt]">{contacto}</p>}
      </div>
    </div>
  );
}

/** Pie de los documentos impresos (texto que define la clínica). */
export async function PieClinica({ clinicaId }: { clinicaId: string }) {
  const m = await membreteClinica(clinicaId);
  return m.pie_documentos ? <p className="mt-6 border-t border-gray-300 pt-2 text-center text-[8pt] text-gray-700">{m.pie_documentos}</p> : null;
}
