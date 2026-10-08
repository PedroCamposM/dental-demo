import { cookies } from "next/headers";
import Link from "next/link";
import { cerrarSesion } from "@/app/login/actions";
import { ControlSesion } from "@/components/control-sesion";
import { modulos } from "@/lib/funciones";
import { veGestion } from "@/lib/permisos";
import { NOMBRE_ROL, type Rol, type Sesion } from "@/lib/sesion";
import { COOKIE_BLOQUEO } from "@/lib/sesion-segura/inactividad";

type Seccion = "pacientes" | "gestion" | "plantillas" | "configuracion";

// La atención del paciente va primero; la gestión es un módulo más.
const SECCIONES: { clave: Seccion; href: string; texto: string; ve: (rol: Rol) => boolean; etapa1?: boolean }[] = [
  { clave: "pacientes", href: "/pacientes", texto: "Pacientes", ve: () => true, etapa1: true },
  { clave: "gestion", href: "/gestion", texto: "Gestión", ve: veGestion },
  { clave: "plantillas", href: "/plantillas", texto: "Plantillas", ve: (rol) => rol === "admin" || rol === "recepcion" },
  { clave: "configuracion", href: "/configuracion", texto: "Configuración", ve: (rol) => rol === "admin", etapa1: true },
];

export async function Encabezado({ sesion, seccion }: { sesion: Sesion; seccion?: Seccion }) {
  const bloqueado = (await cookies()).get(COOKIE_BLOQUEO)?.value === "1";
  const visibles = SECCIONES.filter((s) => (!s.etapa1 || modulos.etapa1) && s.ve(sesion.rol));
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
          {sesion.inactividadMinutos !== null && (
            <ControlSesion minutos={sesion.inactividadMinutos} bloqueadoInicial={bloqueado} ahoraServidor={Date.now()} />
          )}
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
