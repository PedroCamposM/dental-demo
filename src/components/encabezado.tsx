import Link from "next/link";
import { cerrarSesion } from "@/app/login/actions";
import { modulos } from "@/lib/funciones";
import { NOMBRE_ROL, type Sesion } from "@/lib/sesion";

const SECCIONES = [
  { clave: "tablero", href: "/", texto: "Tablero" },
  ...(modulos.pacientes ? [{ clave: "pacientes", href: "/pacientes", texto: "Pacientes" } as const] : []),
  { clave: "plantillas", href: "/plantillas", texto: "Plantillas" },
] as const;

export function Encabezado({ sesion, seccion = "tablero" }: {
  sesion: Sesion;
  seccion?: (typeof SECCIONES)[number]["clave"];
}) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="font-semibold">{sesion.clinica}</p>
            <p className="text-sm text-gray-600">
              {sesion.nombre} · {NOMBRE_ROL[sesion.rol]}
            </p>
          </div>
          <nav aria-label="Secciones" className="flex gap-1">
            {SECCIONES.map((s) => (
              <Link
                key={s.clave}
                href={s.href}
                aria-current={s.clave === seccion ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  s.clave === seccion ? "bg-teal-50 font-medium text-teal-800" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s.texto}
              </Link>
            ))}
          </nav>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
