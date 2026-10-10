import { fechaLima, formatearFecha } from "@/lib/fechas";
import { modulos } from "@/lib/funciones";
import { cargarAlertas } from "@/lib/historia/alertas";

const BASE = "sticky top-0 z-30 mb-4 rounded-md border px-3 py-2 text-sm";

/**
 * Banner fijo con las alertas clínicas del paciente (regla 4). Solo muestra lo
 * registrado en su historia, con la fecha de registro; nunca recomienda nada.
 */
export async function AlertasPaciente({ pacienteId }: { pacienteId: string }) {
  if (!modulos.etapa3) return null;
  const { error, porPaciente } = await cargarAlertas([pacienteId]);
  const alertas = porPaciente.get(pacienteId);

  if (error) {
    return (
      <div role="alert" aria-label="Alertas clínicas" className={`${BASE} border-red-300 bg-red-50 text-red-900`}>
        No se pudieron cargar las alertas clínicas de este paciente. Recarga la página antes de atenderlo.
      </div>
    );
  }
  if (!alertas) {
    return (
      <div role="note" aria-label="Alertas clínicas" className={`${BASE} border-gray-200 bg-gray-50 text-gray-700`}>
        Historia clínica sin registrar: aún no hay alertas registradas para este paciente.
      </div>
    );
  }
  const fecha = formatearFecha(fechaLima(alertas.registradaEl));
  if (alertas.frases.length === 0) {
    return (
      <div role="note" aria-label="Alertas clínicas" className={`${BASE} border-gray-200 bg-white text-gray-600`}>
        Sin alertas registradas en la historia clínica (actualizada el {fecha}).
      </div>
    );
  }
  return (
    <div role="note" aria-label="Alertas clínicas" className={`${BASE} border-red-300 bg-red-50 text-red-900 shadow-sm`}>
      <span className="font-semibold">Alertas registradas:</span>{" "}
      {alertas.frases.map((f, i) => (
        <span key={f}>{i > 0 && <span aria-hidden="true"> · </span>}<span className="font-medium">{f}</span></span>
      ))}
      <span className="text-red-800"> · según la historia del {fecha}</span>
    </div>
  );
}
