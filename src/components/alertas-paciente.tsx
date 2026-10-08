import { modulos } from "@/lib/funciones";
import { cargarAlertas } from "@/lib/historia/alertas";

/**
 * Banner fijo con las alertas clínicas del paciente (regla 4). Solo muestra lo
 * registrado en su historia; nunca recomienda nada.
 */
export async function AlertasPaciente({ pacienteId }: { pacienteId: string }) {
  if (!modulos.etapa3) return null;
  const alertas = (await cargarAlertas([pacienteId])).get(pacienteId);

  if (!alertas) {
    return (
      <div role="note" aria-label="Alertas clínicas"
        className="sticky top-0 z-30 mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        Historia clínica sin registrar: aún no hay alertas registradas para este paciente.
      </div>
    );
  }
  if (alertas.frases.length === 0) {
    return (
      <div role="note" aria-label="Alertas clínicas"
        className="sticky top-0 z-30 mb-4 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
        Sin alertas registradas en la historia clínica.
      </div>
    );
  }
  return (
    <div role="note" aria-label="Alertas clínicas"
      className="sticky top-0 z-30 mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 shadow-sm">
      <span className="font-semibold">Alertas registradas:</span>{" "}
      {alertas.frases.map((f, i) => (
        <span key={f}>{i > 0 && <span aria-hidden="true"> · </span>}<span className="font-medium">{f}</span></span>
      ))}
    </div>
  );
}
