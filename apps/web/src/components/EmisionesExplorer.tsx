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

const FILTROS_ESTADO: { valor: string; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "borrador", label: "Por confirmar" },
  { valor: "pending", label: "Pendientes" },
  { valor: "running", label: "Procesando" },
  { valor: "failed", label: "Con errores" },
  { valor: "done", label: "Completados" },
];

function BarraProgreso({ boletas }: { boletas: Boleta[] }) {
  const total = boletas.length;
  if (total === 0) return null;
  const exitosas = boletas.filter((b) => b.status === "success").length;
  const fallidas = boletas.filter((b) => b.status === "failed").length;
  const pendientes = total - exitosas - fallidas;

  return (
    <div
      className="flex h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-white/5"
      role="img"
      aria-label={`${exitosas} emitidas, ${fallidas} con error, ${pendientes} pendientes de ${total} boletas`}
    >
      {exitosas > 0 && <span className="bg-success/70" style={{ width: `${(exitosas / total) * 100}%` }} />}
      {fallidas > 0 && <span className="bg-danger/70" style={{ width: `${(fallidas / total) * 100}%` }} />}
      {pendientes > 0 && <span className="bg-accent/70" style={{ width: `${(pendientes / total) * 100}%` }} />}
    </div>
  );
}

function coincideBusqueda(archivo: Archivo, busqueda: string): boolean {
  if (!busqueda) return true;
  const q = busqueda.toLowerCase();
  return (
    (archivo.emisorRut ?? "").toLowerCase().includes(q) ||
    (archivo.emisorRazonSocial ?? "").toLowerCase().includes(q) ||
    archivo.csvFilename.toLowerCase().includes(q)
  );
}

export function EmisionesExplorer({ archivos }: { archivos: Archivo[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const conteosPorEstado = useMemo(() => {
    const conteos: Record<string, number> = {};
    for (const a of archivos) conteos[a.batchStatus] = (conteos[a.batchStatus] ?? 0) + 1;
    return conteos;
  }, [archivos]);

  const archivosFiltrados = useMemo(
    () =>
      archivos.filter(
        (a) =>
          coincideBusqueda(a, busqueda) && (filtroEstado === "todos" || a.batchStatus === filtroEstado),
      ),
    [archivos, busqueda, filtroEstado],
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS_ESTADO.map((f) => {
            const cantidad = f.valor === "todos" ? archivos.length : conteosPorEstado[f.valor] ?? 0;
            if (f.valor !== "todos" && cantidad === 0) return null;
            return (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltroEstado(f.valor)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filtroEstado === f.valor
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-white/[0.02] text-muted hover:text-text"
                }`}
              >
                {f.label} <span className="opacity-60">{cantidad}</span>
              </button>
            );
          })}
        </div>
        <input
          placeholder="Buscar por RUT, razón social o archivo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-border-strong sm:w-64"
        />
      </div>

      {grupos.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted">
          Nada coincide con los filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grupos.map((grupo) => (
            <li
              key={`${grupo.rut}|${grupo.razonSocial}`}
              className="glass-panel gradient-border bento-card overflow-hidden rounded-xl shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]"
            >
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
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 transition-colors hover:bg-surface-2/50">
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
                              <BarraProgreso boletas={archivo.boletas} />
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
                                    className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/[0.02]"
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
