"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/Spinner";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const esDeployViejo = error.message?.includes("Failed to find Server Action");

  useEffect(() => {
    if (esDeployViejo) {
      window.location.reload();
    }
  }, [esDeployViejo]);

  if (esDeployViejo) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center text-muted">
        <Spinner />
        <p>Se actualizó la app, recargando…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-muted">Ocurrió un error inesperado.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary px-4 py-2 font-medium transition-colors hover:bg-primary-hover"
      >
        Recargar página
      </button>
    </main>
  );
}
