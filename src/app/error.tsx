"use client";

export default function ErrorPagina({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="text-gray-600">No pudimos cargar esta página. Revisa tu conexión e inténtalo de nuevo.</p>
      <button type="button" onClick={reset} className="self-start rounded-md bg-teal-700 px-4 py-2 font-medium text-white">
        Reintentar
      </button>
    </main>
  );
}
