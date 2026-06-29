export type EstadoArchivo = "borrador" | "pending" | "running" | "completo" | "incompleto" | "error";

interface BoletaMinima {
  status: string;
}

/**
 * El estado visible del archivo no es el enum crudo de la DB (que solo
 * distingue done/failed): se deriva del resultado real de las boletas para
 * separar "falló todo" de "falló una parte" — son severidades distintas.
 */
export function calcularEstadoArchivo(batchStatus: string, boletas: BoletaMinima[]): EstadoArchivo {
  if (batchStatus === "borrador") return "borrador";
  if (batchStatus === "pending") return "pending";
  if (batchStatus === "running") return "running";
  if (batchStatus === "done") return "completo";
  const exitosas = boletas.filter((b) => b.status === "success").length;
  return exitosas > 0 ? "incompleto" : "error";
}

export const ESTADO_ARCHIVO_LABEL: Record<EstadoArchivo, string> = {
  borrador: "Por confirmar",
  pending: "Pendiente",
  running: "Procesando",
  completo: "Completo",
  incompleto: "Incompleto",
  error: "Error",
};

export const ESTADO_ARCHIVO_BADGE: Record<EstadoArchivo, string> = {
  borrador: "border-warning/40 bg-warning/15 text-warning",
  pending: "border-border bg-surface-2 text-muted",
  running: "border-accent/40 bg-info/15 text-accent",
  completo: "border-success/40 bg-success/15 text-success",
  incompleto: "border-warning/40 bg-warning/15 text-warning",
  error: "border-danger/40 bg-danger/15 text-danger",
};

export const ESTADO_BOLETA_LABEL: Record<string, string> = {
  pending: "Pendiente",
  success: "Correcto",
  failed: "Error",
};

export const ESTADO_BOLETA_BADGE: Record<string, string> = {
  pending: "border-border bg-surface-2 text-muted",
  success: "border-success/40 bg-success/15 text-success",
  failed: "border-danger/40 bg-danger/15 text-danger",
};
