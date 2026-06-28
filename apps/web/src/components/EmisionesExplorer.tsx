"use client";

import { useMemo, useState } from "react";

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
  pdfPath: string | null;
  batchId: string;
}

interface Archivo {
  batchId: string;
  csvFilename: string;
  batchStatus: string;
  createdAt: string;
  emisorRut: string | null;
  emisorRazonSocial: string | null;
  boletas: Boleta[];
}

const BATCH_LABEL: Record<string, string> = {
  borrador: "Por confirmar",
  pending: "Pendiente",
  running: "Procesando",
  done: "Completado",
  failed: "Con errores",
};

const BATCH_BADGE: Record<string, string> = {
  borrador: "border-warning/40 bg-warning/15 text-warning",
  pending: "border-border bg-surface-2 text-muted",
  running: "border-accent/40 bg-info/15 text-accent",
  done: "border-success/40 bg-success/15 text-success",
  failed: "border-danger/40 bg-danger/15 text-danger",
};

const BOLETA_LABEL: Record<string, string> = { pending: "Pendiente", success: "Emitida", failed: "Falló" };
const BOLETA_BADGE: Record<string, string> = {
  pending: "border-border bg-surface-2 text-muted",
  success: "border-success/40 bg-success/15 text-success",
  failed: "border-danger/40 bg-danger/15 text-danger",
};

function coincide(valor: string | null | undefined, filtro: string): boolean {
  if (!filtro) return true;
  return (valor ?? "").toLowerCase().includes(filtro.toLowerCase());
}

export function EmisionesExplorer({ archivos }: { archivos: Archivo[] }) {
  const [filtroRut, setFiltroRut] = useState("");
  const [filtroRazonSocial, setFiltroRazonSocial] = useState("");
  const [filtroArchivo, setFiltroArchivo] = useState("");

  const archivosFiltrados = useMemo(
    () =>
      archivos.filter(
        (a) =>
          coincide(a.emisorRut, filtroRut) &&
          coincide(a.emisorRazonSocial, filtroRazonSocial) &&
          coincide(a.csvFilename, filtroArchivo),
      ),
    [archivos, filtroRut, filtroRazonSocial, filtroArchivo],
  );

  const grupos = useMemo(() => {
    const map = new Map<string, { rut: string; razonSocial: string; archivos: Archivo[] }>();
    for (const a of archivosFiltrados) {
      const key = `${a.emisorRut}|${a.emisorRazonSocial}`;
      const grupo = map.get(key) ?? { rut: a.emisorRut ?? "—", razonSocial: a.emisorRazonSocial ?? "—", archivos: [] };
      grupo.archivos.push(a);
      map.set(key, grupo);
    }
    return Array.from(map.values());
  }, [archivosFiltrados]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <input
          placeholder="Filtrar por RUT emisor"
          value={filtroRut}
          onChange={(e) => setFiltroRut(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-border-strong"
        />
        <input
          placeholder="Filtrar por razón social"
          value={filtroRazonSocial}
          onChange={(e) => setFiltroRazonSocial(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-border-strong"
        />
        <input
          placeholder="Filtrar por archivo"
          value={filtroArchivo}
          onChange={(e) => setFiltroArchivo(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-border-strong"
        />
      </div>

      {grupos.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted">
          Nada coincide con los filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grupos.map((grupo) => (
            <li key={`${grupo.rut}|${grupo.razonSocial}`} className="glass-panel overflow-hidden rounded-card shadow-card">
              <details open className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition-colors hover:bg-surface-2">
                  <span className="text-accent transition-transform duration-200 group-open:rotate-90">▶</span>
                  <div>
                    <p className="font-medium">{grupo.razonSocial}</p>
                    <p className="text-sm text-muted">
                      RUT {grupo.rut} — {grupo.archivos.length} archivo{grupo.archivos.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </summary>

                <div className="border-t border-border p-4">
                  <ul className="flex flex-col gap-2">
                    {grupo.archivos.map((archivo) => (
                      <li key={archivo.batchId} className="overflow-hidden rounded-md border border-border bg-sunken">
                        <details className="group/file">
                          <summary className="flex cursor-pointer list-none items-center justify-between p-3 transition-colors hover:bg-surface-2/50">
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="text-accent transition-transform duration-200 group-open/file:rotate-90">
                                ▶
                              </span>
                              <span className="truncate font-medium">{archivo.csvFilename}</span>
                              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted">
                                {archivo.boletas.length} boleta{archivo.boletas.length === 1 ? "" : "s"}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-caption font-medium ${BATCH_BADGE[archivo.batchStatus]}`}
                              >
                                {BATCH_LABEL[archivo.batchStatus]}
                              </span>
                              <a
                                href={`/dashboard/batches/${archivo.batchId}`}
                                className="rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Abrir
                              </a>
                            </span>
                          </summary>

                          <div className="overflow-x-auto border-t border-border">
                            <table className="w-full border-collapse text-left text-sm">
                              <thead>
                                <tr className="border-b border-border bg-white/[0.02] text-caption uppercase tracking-wide text-faint">
                                  <th className="px-3 py-2 font-medium">Nombre</th>
                                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                                  <th className="px-3 py-2 font-medium">Tipo</th>
                                  <th className="px-3 py-2 font-medium">Método</th>
                                  <th className="px-3 py-2 font-medium">Receptor</th>
                                  <th className="px-3 py-2 font-medium">Detalle</th>
                                  <th className="px-3 py-2 font-medium">Estado</th>
                                  <th className="px-3 py-2 font-medium"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {archivo.boletas.map((b) => (
                                  <tr
                                    key={b.id}
                                    className="border-b border-border/60 last:border-b-0 odd:bg-white/[0.015] hover:bg-white/[0.04]"
                                  >
                                    <td className="px-3 py-2 font-medium">{b.nombre}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      ${b.monto.toLocaleString("es-CL")}
                                    </td>
                                    <td className="px-3 py-2 capitalize text-muted">{b.tipoBoleta}</td>
                                    <td className="px-3 py-2 capitalize text-muted">{b.metodoPago}</td>
                                    <td className="px-3 py-2 text-muted">
                                      {b.conReceptor ? `${b.receptorNombre} (${b.receptorRut})` : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-muted">{b.conDetalle ? b.detalle : "—"}</td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`inline-block rounded-full border px-2 py-0.5 text-caption font-medium ${BOLETA_BADGE[b.status]}`}
                                      >
                                        {BOLETA_LABEL[b.status]}
                                      </span>
                                      {b.status === "failed" && b.errorMessage && (
                                        <span className="ml-1 cursor-help text-caption text-faint" title={b.errorMessage}>
                                          (ver detalle)
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {b.status === "success" && (
                                        <a
                                          href={`/api/batches/${b.batchId}/pdf/${b.id}`}
                                          className="rounded font-medium text-accent transition-colors hover:text-accent-hover"
                                        >
                                          PDF
                                        </a>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
