import Link from "next/link";
import { modulos } from "@/lib/funciones";

type Pestana = "filiacion" | "historia" | "signos" | "odontograma" | "examen" | "plan" | "evolucion" | "archivos" | "consentimientos" | "documentos" | "interconsultas";

/** Pestañas de la ficha del paciente. La historia solo para quien la ve (RLS lo exige igual). */
export function PestanasPaciente({ id, actual, veClinico }: { id: string; actual: Pestana; veClinico: boolean }) {
  const pestanas: { clave: Pestana; href: string; texto: string }[] = [
    { clave: "filiacion", href: `/pacientes/${id}`, texto: "Filiación" },
    ...(modulos.etapa3 && veClinico ? [
      { clave: "historia" as const, href: `/pacientes/${id}/historia`, texto: "Historia clínica" },
      { clave: "signos" as const, href: `/pacientes/${id}/signos`, texto: "Signos vitales" },
    ] : []),
    ...(modulos.etapa4 && veClinico ? [
      { clave: "odontograma" as const, href: `/pacientes/${id}/odontograma`, texto: "Odontograma" },
      { clave: "examen" as const, href: `/pacientes/${id}/examen`, texto: "Examen y diagnóstico" },
    ] : []),
    // El plan lo ve toda la clínica: recepción registra si el paciente acepta el presupuesto.
    ...(modulos.etapa5 ? [{ clave: "plan" as const, href: `/pacientes/${id}/plan`, texto: "Plan de tratamiento" }] : []),
    ...(modulos.etapa6 && veClinico ? [{ clave: "evolucion" as const, href: `/pacientes/${id}/evolucion`, texto: "Evolución" }] : []),
    ...(modulos.etapa7 && veClinico ? [{ clave: "archivos" as const, href: `/pacientes/${id}/archivos`, texto: "Imágenes y archivos" }] : []),
    ...(modulos.etapa7 && veClinico ? [{ clave: "consentimientos" as const, href: `/pacientes/${id}/consentimientos`, texto: "Consentimientos" }] : []),
    ...(modulos.etapa7 && veClinico ? [{ clave: "documentos" as const, href: `/pacientes/${id}/documentos`, texto: "Recetas y documentos" }] : []),
    ...(modulos.etapa7 && veClinico ? [{ clave: "interconsultas" as const, href: `/pacientes/${id}/interconsultas`, texto: "Interconsultas" }] : []),
  ];
  if (pestanas.length < 2) return null;
  return (
    <nav aria-label="Secciones del paciente" className="mt-4 flex flex-wrap gap-1 border-b border-gray-200">
      {pestanas.map((p) => (
        <Link key={p.clave} href={p.href} aria-current={p.clave === actual ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${
            p.clave === actual ? "border-teal-700 font-medium text-teal-800" : "border-transparent text-gray-600 hover:text-gray-900"
          }`}>
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}
