import { redirect } from "next/navigation";
import { modulos } from "@/lib/funciones";
import { pantallaInicial } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import { cerrarSesion } from "./login/actions";

/** Portada: lleva a cada usuario a su primera pantalla (Pacientes; o Gestión mientras Pacientes esté apagado). */
export default async function Inicio() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return (
      <Aviso titulo="Sin acceso a una clínica">
        Tu usuario no está activo en ninguna clínica. Pide al administrador que te invite o te reactive.
      </Aviso>
    );
  }
  const destino = pantallaInicial(sesion.rol, modulos.etapa1);
  if (destino) redirect(destino);
  return (
    <Aviso titulo="Aún no hay pantallas para tu rol">
      Las pantallas de pacientes se están habilitando. Vuelve a intentarlo más tarde o consulta al administrador.
    </Aviso>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="text-gray-600">{children}</p>
      <form action={cerrarSesion}>
        <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
