import { redirect } from "next/navigation";
import { modulos } from "@/lib/funciones";
import { pantallaInicial } from "@/lib/permisos";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "./login/actions";

/**
 * Portada: lleva a cada usuario a su primera pantalla (Pacientes; o Gestión mientras Pacientes esté apagado).
 * Sin clínica: al panel del superadministrador o a crear la clínica de prueba (Etapa 16).
 */
export default async function Inicio() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    if (modulos.etapa16) {
      // Sin clínica: el superadministrador va a su panel; quien se registró a la prueba, a crear su clínica.
      const supabase = await createClient();
      const [{ data: esSuper }, { data: { user } }] = await Promise.all([supabase.rpc("es_superadmin"), supabase.auth.getUser()]);
      if (esSuper === true) redirect("/plataforma");
      if (typeof user?.user_metadata?.clinica === "string") redirect("/bienvenida");
    }
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
