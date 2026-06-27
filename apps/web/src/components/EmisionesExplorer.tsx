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

const BATCH_COLOR: Record<string, string> = {
  borrador: "#fbbf24",
  pending: "#eaeaea",
  running: "#3282b8",
  done: "#4ade80",
  failed: "#f87171",
};

const BOLETA_LABEL: Record<string, string> = { pending: "Pendiente", success: "Emitida", failed: "Falló" };
const BOLETA_COLOR: Record<string, string> = { pending: "#eaeaea", success: "#4ade80", failed: "#f87171" };

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
          className="rounded-md border border-[#1f3460] bg-[#16213e] px-3 py-1.5 text-sm"
        />
        <input
          placeholder="Filtrar por razón social"
          value={filtroRazonSocial}
          onChange={(e) => setFiltroRazonSocial(e.target.value)}
          className="rounded-md border border-[#1f3460] bg-[#16213e] px-3 py-1.5 text-sm"
        />
        <input
          placeholder="Filtrar por archivo"
          value={filtroArchivo}
          onChange={(e) => setFiltroArchivo(e.target.value)}
          className="rounded-md border border-[#1f3460] bg-[#16213e] px-3 py-1.5 text-sm"
        />
      </div>

      {grupos.length === 0 ? (
        <p className="text-sm text-[#a0aec0]">Nada coincide con los filtros.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grupos.map((grupo) => (
            <li key={`${grupo.rut}|${grupo.razonSocial}`} className="rounded-md border border-[#1f3460] bg-[#16213e]">
              <details open className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <span className="text-[#3282b8] transition-transform duration-200 group-open:rotate-90">▶</span>
                  <div>
                    <p className="font-medium">{grupo.razonSocial}</p>
                    <p className="text-sm text-[#a0aec0]">
                      RUT {grupo.rut} — {grupo.archivos.length} archivo{grupo.archivos.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </summary>

                <div className="border-t border-[#1f3460] p-4">
                  <ul className="flex flex-col gap-2">
                    {grupo.archivos.map((archivo) => (
                      <li key={archivo.batchId} className="rounded-md border border-[#1f3460] bg-[#1a1a2e]">
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center justify-between p-3">
                            <span className="flex items-center gap-3">
                              <span className="text-[#3282b8] transition-transform duration-200 group-open:rotate-90">
                                ▶
                              </span>
                              <span>{archivo.csvFilename}</span>
                              <span className="text-xs text-[#a0aec0]">
                                {archivo.boletas.length} boleta{archivo.boletas.length === 1 ? "" : "s"}
                              </span>
                            </span>
                            <span className="flex items-center gap-3">
                              <span style={{ color: BATCH_COLOR[archivo.batchStatus] }} className="text-sm">
                                {BATCH_LABEL[archivo.batchStatus]}
                              </span>
                              <a
                                href={`/dashboard/batches/${archivo.batchId}`}
                                className="text-sm text-[#3282b8]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Abrir
                              </a>
                            </span>
                          </summary>

                          <div className="overflow-x-auto border-t border-[#1f3460] p-3">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="text-[#a0aec0]">
                                  <th className="px-2 py-1">Nombre</th>
                                  <th className="px-2 py-1">Monto</th>
                                  <th className="px-2 py-1">Tipo</th>
                                  <th className="px-2 py-1">Método</th>
                                  <th className="px-2 py-1">Receptor</th>
                                  <th className="px-2 py-1">Detalle</th>
                                  <th className="px-2 py-1">Estado</th>
                                  <th className="px-2 py-1"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {archivo.boletas.map((b) => (
                                  <tr key={b.id} className="border-t border-[#1f3460]">
                                    <td className="px-2 py-1">{b.nombre}</td>
                                    <td className="px-2 py-1">${b.monto.toLocaleString("es-CL")}</td>
                                    <td className="px-2 py-1">{b.tipoBoleta}</td>
                                    <td className="px-2 py-1">{b.metodoPago}</td>
                                    <td className="px-2 py-1">
                                      {b.conReceptor ? `${b.receptorNombre} (${b.receptorRut})` : "—"}
                                    </td>
                                    <td className="px-2 py-1">{b.conDetalle ? b.detalle : "—"}</td>
                                    <td className="px-2 py-1" style={{ color: BOLETA_COLOR[b.status] }}>
                                      {BOLETA_LABEL[b.status]}
                                      {b.status === "failed" && b.errorMessage && (
                                        <span className="ml-1 text-xs text-[#a0aec0]" title={b.errorMessage}>
                                          (ver detalle)
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1">
                                      {b.status === "success" && (
                                        <a
                                          href={`/api/batches/${b.batchId}/pdf/${b.id}`}
                                          className="text-[#3282b8]"
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
