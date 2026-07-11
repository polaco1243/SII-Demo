export const TIPO_EVENTO_LABEL: Record<string, string> = {
  credencial_agregada: "Credencial agregada",
  credencial_confirmada: "Razón social confirmada",
  credencial_eliminada: "Razón social eliminada",
  credencial_clave_actualizada: "Clave SII actualizada",
  csv_subido: "CSV subido",
  batch_confirmado: "Emisión confirmada",
  batch_cancelado: "Emisión cancelada",
  boleta_reintentada: "Boleta reintentada",
  factura_reintentada: "Factura reintentada",
  archivo_procesado: "Archivo procesado (sistema)",
};

export const TIPO_EVENTO_BADGE: Record<string, string> = {
  credencial_agregada: "border-accent/40 bg-accent/10 text-accent",
  credencial_confirmada: "border-success/40 bg-success/15 text-success",
  credencial_eliminada: "border-danger/40 bg-danger/15 text-danger",
  credencial_clave_actualizada: "border-accent/40 bg-accent/10 text-accent",
  csv_subido: "border-accent/40 bg-accent/10 text-accent",
  batch_confirmado: "border-success/40 bg-success/15 text-success",
  batch_cancelado: "border-warning/40 bg-warning/15 text-warning",
  boleta_reintentada: "border-info/40 bg-info/15 text-accent",
  factura_reintentada: "border-info/40 bg-info/15 text-accent",
  archivo_procesado: "border-border bg-surface-2 text-muted",
};
