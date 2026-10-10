"use client";

/**
 * Hoja A4 para imprimir o guardar como PDF desde el navegador (consentimientos,
 * recetas, constancias). Los botones no salen en el papel.
 */
export function DocumentoImprimible({ volver, children }: { volver: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <a href={volver} className="text-sm font-medium text-teal-700 hover:underline">← Volver</a>
        <button type="button" onClick={() => window.print()}
          className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
          Imprimir o guardar como PDF
        </button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white px-[15mm] py-[12mm] text-[11pt] leading-snug text-black shadow print:max-w-none print:p-0 print:shadow-none">
        {children}
      </article>
    </div>
  );
}

/** Línea para firma manuscrita, con su rótulo debajo. */
export function LineaFirma({ rotulo }: { rotulo: string }) {
  return (
    <div className="flex flex-col items-center pt-12 text-center text-[9pt]">
      <span className="w-full border-t border-black" />
      <span className="mt-1">{rotulo}</span>
    </div>
  );
}

/** Recuadro para la huella digital. */
export function RecuadroHuella() {
  return (
    <div className="flex flex-col items-center text-[9pt]">
      <span className="h-[26mm] w-[20mm] border border-black" />
      <span className="mt-1">Huella digital</span>
    </div>
  );
}
