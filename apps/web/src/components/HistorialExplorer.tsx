"use client";

import { useMemo, useState } from "react";
import {
  calcularEstadoArchivo,
  ESTADO_ARCHIVO_LABEL,
  ESTADO_ARCHIVO_BADGE,
  ESTADO_BOLETA_LABEL,
  ESTADO_BOLETA_BADGE,
} from "@/lib/estados";

interface Boleta {
  id: string;
  nombre: string;
  monto: number;
  tipoBoleta: string;
  metodoPago: string;
  conReceptor: boolean;
  receptorNombre: string | null;
  receptorRut: string | null;
  conDetalle: boolean;
  detalle: string | null;
  status: string;
  errorMessage: string | null;
}

interface Archivo {
  batchId: string;
  csvFilename: string;
  batchStatus: string;
  emisorRut: string | null;
  emisorRazonSocial: string | null;
  credencialActiva: boolean;
  credencialActualizadaEn: string;
  boletas: Boleta[];
}

const BOLETA_LABEL = ESTADO_BOLETA_LABEL;
const BOLETA_BADGE = ESTADO_BOLETA_BADGE;
const TIPO_BOLETA_LABEL: Record<string, string> = { exenta: "Boleta exenta", afecta: "Boleta afecta" };
const METODO_PAGO_LABEL: Record<string, string> = {
  debito: "Débito",
  credito: "Crédito",
  efectivo: "Efectivo",
  otro: "Otro",
};

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export function HistorialExplorer({ archivos }: { archivos: Archivo[] }) {
  const [boletaAbierta, setBoletaAbierta] = useState<Record<string, string | null>>({});
  const [archivoAbierto, setArchivoAbierto] = useState<Record<string, string | null>>({});

  const grupos = useMemo(() => {
    const map = new Map<string, { rut: string; razonSocial: string; activa: boolean; actualizadaEn: string; archivos: Archivo[] }>();
    for (const a of archivos) {
      const key = `${a.emisorRut}|${a.emisorRazonSocial}`;
      const grupo = map.get(key) ?? {
        rut: a.emisorRut ?? "—",
        razonSocial: a.emisorRazonSocial ?? "—",
        activa: a.credencialActiva,
        actualizadaEn: a.credencialActualizadaEn,
        archivos: [],
      };
      grupo.archivos.push(a);
      map.set(key, grupo);
    }
    return Array.from(map.values());
  }, [archivos]);

  if (grupos.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted">
        Nada coincide con los filtros.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {grupos.map((grupo) => {
        const grupoKey = `${grupo.rut}|${grupo.razonSocial}`;
        const batchIdAbierto = archivoAbierto[grupoKey] ?? null;

        return (
          <li
            key={grupoKey}
            className="glass-panel gradient-border bento-card overflow-hidden rounded-xl shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]"
          >
            <details open className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-2">
                <span className="flex items-center gap-3">
                  <span className="text-accent transition-transform duration-200 group-open:rotate-90">▶</span>
                  <div>
                    <p className="font-medium">{grupo.razonSocial}</p>
                    <p className="text-sm text-muted">
                      RUT {grupo.rut} — {grupo.archivos.length} archivo{grupo.archivos.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </span>
                {!grupo.activa && (
                  <span className="shrink-0 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1 text-caption font-medium text-danger">
                    Inactiva desde {fechaCorta(grupo.actualizadaEn)}
                  </span>
                )}
              </summary>

              <div className="border-t border-border p-4">
                <ul className="flex flex-col gap-2">
                  {grupo.archivos.map((archivo) => {
                    const abierto = batchIdAbierto === archivo.batchId;
                    const boletaIdAbierta = boletaAbierta[archivo.batchId] ?? null;

                    return (
                      <li key={archivo.batchId} className="overflow-hidden rounded-md border border-border bg-white/[0.05]">
                        <button
                          type="button"
                          onClick={() =>
                            setArchivoAbierto((prev) => ({
                              ...prev,
                              [grupoKey]: prev[grupoKey] === archivo.batchId ? null : archivo.batchId,
                            }))
                          }
                          className="flex w-full cursor-pointer items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-surface-2/50"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={`text-accent transition-transform duration-200 ${abierto ? "rotate-90" : ""}`}>▶</span>
                            <span className="truncate font-medium">{archivo.csvFilename}</span>
                            <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted">
                              {archivo.boletas.length} boleta{archivo.boletas.length === 1 ? "" : "s"}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-caption font-medium ${ESTADO_ARCHIVO_BADGE[calcularEstadoArchivo(archivo.batchStatus, archivo.boletas)]}`}
                          >
                            {ESTADO_ARCHIVO_LABEL[calcularEstadoArchivo(archivo.batchStatus, archivo.boletas)]}
                          </span>
                        </button>

                        {abierto && (
                          <ul className="flex flex-col gap-1.5 border-t border-border p-2">
                            {archivo.boletas.map((b) => {
                              const boletaAbiertaFlag = boletaIdAbierta === b.id;
                              return (
                                <li key={b.id} className="overflow-hidden rounded-md border border-border-strong bg-white/[0.08]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBoletaAbierta((prev) => ({
                                        ...prev,
                                        [archivo.batchId]: prev[archivo.batchId] === b.id ? null : b.id,
                                      }))
                                    }
                                    className="flex w-full cursor-pointer items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-surface-2/50"
                                  >
                                    <span className="flex min-w-0 items-center gap-3">
                                      <span className={`text-accent transition-transform duration-200 ${boletaAbiertaFlag ? "rotate-90" : ""}`}>
                                        ▶
                                      </span>
                                      <span className="min-w-0 truncate font-medium">{b.nombre}</span>
                                      <span className="shrink-0 tabular-nums text-muted">${b.monto.toLocaleString("es-CL")}</span>
                                    </span>
                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-caption font-medium ${BOLETA_BADGE[b.status]}`}>
                                      {BOLETA_LABEL[b.status]}
                                    </span>
                                  </button>
                                  {boletaAbiertaFlag && (
                                    <div className="flex flex-col gap-1.5 border-t border-border p-3 text-sm text-muted">
                                      <p>
                                        {TIPO_BOLETA_LABEL[b.tipoBoleta] ?? b.tipoBoleta} — {METODO_PAGO_LABEL[b.metodoPago] ?? b.metodoPago}
                                      </p>
                                      {b.conReceptor && (
                                        <p>
                                          Receptor: {b.receptorNombre} ({b.receptorRut})
                                        </p>
                                      )}
                                      {b.conDetalle && b.detalle && <p>Detalle: {b.detalle}</p>}
                                      {b.status === "failed" && b.errorMessage && <p className="text-danger">{b.errorMessage}</p>}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
