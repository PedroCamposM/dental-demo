import { cerrarSesion } from "@/app/login/actions";
import { NOMBRE_ROL, type Sesion } from "@/lib/sesion";

export function Encabezado({ sesion }: { sesion: Sesion }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="font-semibold">{sesion.clinica}</p>
          <p className="text-sm text-gray-600">
            {sesion.nombre} · {NOMBRE_ROL[sesion.rol]}
          </p>
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
