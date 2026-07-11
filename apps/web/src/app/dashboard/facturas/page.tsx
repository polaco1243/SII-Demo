import { eq, desc, and, inArray } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ESTADO_ARCHIVO_LABEL, ESTADO_ARCHIVO_BADGE, calcularEstadoArchivo } from "@/lib/estados";

export default async function FacturasPage() {
  const userId = await requireUserId();

  const { filas, facturasPorBatch } = await withUser(userId, async (tx) => {
    const filas = await tx
      .select({
        batchId: schema.batches.id,
        csvFilename: schema.batches.csvFilename,
        batchStatus: schema.batches.status,
        createdAt: schema.batches.createdAt,
        emisorRut: schema.siiCredentials.emisorRut,
        emisorRazonSocial: schema.siiCredentials.emisorRazonSocial,
      })
      .from(schema.batches)
      .innerJoin(schema.siiCredentials, eq(schema.batches.siiCredentialId, schema.siiCredentials.id))
      .where(
        and(
          eq(schema.batches.userId, userId),
          eq(schema.batches.tipoDocumento, "factura"),
          eq(schema.siiCredentials.activa, true),
        ),
      )
      .orderBy(desc(schema.batches.createdAt));

    const facturasTodas = filas.length
      ? await tx.select().from(schema.facturas).where(inArray(schema.facturas.batchId, filas.map((f) => f.batchId)))
      : [];

    const facturasPorBatch = new Map<string, typeof facturasTodas>();
    for (const f of facturasTodas) {
      const arr = facturasPorBatch.get(f.batchId) ?? [];
      arr.push(f);
      facturasPorBatch.set(f.batchId, arr);
    }

    return { filas, facturasPorBatch };
  });

  const archivos = filas.map((f) => {
    const facturas = facturasPorBatch.get(f.batchId) ?? [];
    return {
      ...f,
      createdAt: f.createdAt.toISOString(),
      facturas,
      estado: calcularEstadoArchivo(f.batchStatus, facturas),
    };
  });

  const hayTrabajoEnProceso = archivos.some((b) => b.batchStatus === "pending" || b.batchStatus === "running");

  return (
    <div className="fade-in mx-auto max-w-7xl p-4 md:p-8">
      <AutoRefresh activo={hayTrabajoEnProceso} />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-page">Facturas</h1>
        <a href="/dashboard/facturas/nueva" className="btn-primary rounded-md px-4 py-2 text-sm">
          + Nueva factura
        </a>
      </div>

      {archivos.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted">
          Aún no has subido ningún CSV de facturas.{" "}
          <a href="/dashboard/facturas/nueva" className="font-medium text-accent transition-colors hover:text-accent-hover">
            Sube el primero
          </a>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {archivos.map((archivo) => (
            <li key={archivo.batchId} className="glass-panel flex items-center justify-between gap-4 rounded-card p-4 shadow-card">
              <div className="min-w-0">
                <a
                  href={`/dashboard/facturas/${archivo.batchId}`}
                  className="font-medium transition-colors hover:text-accent"
                >
                  {archivo.csvFilename}
                </a>
                <p className="text-sm text-muted">
                  {archivo.facturas.length} factura{archivo.facturas.length === 1 ? "" : "s"} — {archivo.emisorRazonSocial ?? archivo.emisorRut}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-caption font-medium ${ESTADO_ARCHIVO_BADGE[archivo.estado]}`}>
                {ESTADO_ARCHIVO_LABEL[archivo.estado]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
