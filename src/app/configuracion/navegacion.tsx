import Link from "next/link";
import { modulos } from "@/lib/funciones";

type Pestana = "general" | "procedimientos" | "horarios" | "consentimientos" | "laboratorios";

const PESTANAS: { clave: Pestana; href: string; texto: string; etapa2?: boolean; etapa7?: boolean; etapa10?: boolean }[] = [
  { clave: "general", href: "/configuracion", texto: "General" },
  { clave: "procedimientos", href: "/configuracion/procedimientos", texto: "Procedimientos y aranceles", etapa2: true },
  { clave: "horarios", href: "/configuracion/horarios", texto: "Sillones y horarios", etapa2: true },
  { clave: "consentimientos", href: "/configuracion/consentimientos", texto: "Consentimientos", etapa7: true },
  { clave: "laboratorios", href: "/configuracion/laboratorios", texto: "Laboratorios", etapa10: true },
];

/** Submenú de Configuración (solo administrador). */
export function NavegacionConfiguracion({ actual }: { actual: Pestana }) {
  const visibles = PESTANAS.filter((p) => (!p.etapa2 || modulos.etapa2) && (!p.etapa7 || modulos.etapa7) && (!p.etapa10 || modulos.etapa10));
  if (visibles.length < 2) return null;
  return (
    <nav aria-label="Configuración" className="mt-4 flex flex-wrap gap-1 border-b border-gray-200">
      {visibles.map((p) => (
        <Link
          key={p.clave} href={p.href} aria-current={p.clave === actual ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${
            p.clave === actual ? "border-teal-700 font-medium text-teal-800" : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}
