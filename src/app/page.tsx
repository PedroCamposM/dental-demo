import { Encabezado } from "@/components/encabezado";
import { obtenerSesion } from "@/lib/sesion";
import { cerrarSesion } from "./login/actions";

export default async function Inicio() {
  const sesion = await obtenerSesion();

  if (!sesion) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold">Sin acceso a una clínica</h1>
        <p className="text-gray-600">
          Tu usuario no está activo en ninguna clínica. Pide al administrador que te invite
          o te reactive.
        </p>
        <form action={cerrarSesion}>
          <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            Cerrar sesión
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <Encabezado sesion={sesion} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Dinero en riesgo</h1>
        <p className="mt-1 text-gray-600">
          Mira cuánta plata tienes en riesgo y a quién llamar hoy.
        </p>
        <p className="mt-6 text-sm text-gray-500">El tablero se construye en la siguiente rebanada.</p>
      </main>
    </>
  );
}
