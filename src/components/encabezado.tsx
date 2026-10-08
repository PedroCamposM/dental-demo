import Link from "next/link";
import { cerrarSesion } from "@/app/login/actions";
import { ControlSesion } from "@/components/control-sesion";
import { modulos } from "@/lib/funciones";
import { NOMBRE_ROL, type Rol, type Sesion } from "@/lib/sesion";

type Seccion = "tablero" | "pacientes" | "plantillas" | "configuracion";

const SECCIONES: { clave: Seccion; href: string; texto: string; roles?: Rol[]; etapa1?: boolean }[] = [
  { clave: "tablero", href: "/", texto: "Tablero" },
  { clave: "pacientes", href: "/pacientes", texto: "Pacientes", etapa1: true },
  { clave: "plantillas", href: "/plantillas", texto: "Plantillas" },
  { clave: "configuracion", href: "/configuracion", texto: "Configuración", roles: ["admin"], etapa1: true },
];

export function Encabezado({ sesion, seccion = "tablero" }: { sesion: Sesion; seccion?: Seccion }) {
  const visibles = SECCIONES.filter(
    (s) => (!s.etapa1 || modulos.etapa1) && (!s.roles || s.roles.includes(sesion.rol)),
  );
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
          <nav aria-label="Secciones" className="flex flex-wrap gap-1">
            {visibles.map((s) => (
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
        <div className="flex flex-wrap items-center gap-2">
          {sesion.inactividadMinutos !== null && <ControlSesion minutos={sesion.inactividadMinutos} />}
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
