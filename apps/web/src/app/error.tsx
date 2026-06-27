"use client";

import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const esDeployViejo = error.message?.includes("Failed to find Server Action");

  useEffect(() => {
    if (esDeployViejo) {
      window.location.reload();
    }
  }, [esDeployViejo]);

  if (esDeployViejo) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p>Se actualizó la app, recargando…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <p>Ocurrió un error inesperado.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-[#0f4c75] px-4 py-2 hover:bg-[#3282b8]"
      >
        Recargar página
      </button>
    </main>
  );
}
