import type { Metadata } from "next";
import Link from "next/link";
import { CORREO_CONTACTO } from "@/lib/prueba";

export const metadata: Metadata = { title: "Términos y privacidad – Dental Demo" };

// BORRADOR: este texto es un punto de partida y debe revisarlo un abogado antes de abrir el registro
// al público (Ley 29733 de Protección de Datos Personales y su reglamento).
export default function Terminos() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p role="note" className="mb-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Borrador para revisar con un abogado antes de su publicación definitiva.
      </p>
      <h1 className="text-2xl font-semibold">Términos de uso y política de privacidad</h1>
      <div className="mt-6 flex flex-col gap-4 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold">1. El servicio</h2>
          <p>Dental Demo es un software para que la clínica registre la historia clínica, los tratamientos, la agenda y los pagos de sus pacientes.
            La clínica es la responsable de los datos que registra y de usarlos según la normativa vigente.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">2. Prueba gratuita</h2>
          <p>La prueba dura 30 días desde la creación de la clínica. Al terminar, la información no se borra: la clínica la puede ver y exportar,
            pero no registrar datos nuevos hasta activar un plan.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">3. Datos de los pacientes</h2>
          <p>Los datos se guardan cifrados en tránsito, con acceso por clínica y por rol, y quedan registrados los accesos a la historia clínica.
            No vendemos ni compartimos los datos de los pacientes. Los datos clínicos no se borran: se anulan con motivo.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">4. Decisiones clínicas</h2>
          <p>El sistema no sugiere diagnósticos, dosis ni tratamientos. Las decisiones clínicas son del profesional.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">5. Contacto</h2>
          <p>Para consultas, solicitudes sobre datos personales o la activación del plan, escríbenos a{" "}
            <a href={`mailto:${CORREO_CONTACTO}`} className="font-medium text-teal-700 hover:underline">{CORREO_CONTACTO}</a>.</p>
        </section>
      </div>
      <p className="mt-8"><Link href="/" className="font-medium text-teal-700 hover:underline">Volver</Link></p>
    </main>
  );
}
