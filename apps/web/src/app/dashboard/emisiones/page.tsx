import { redirect } from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EmisionesExplorer } from "@/components/EmisionesExplorer";

async function reintentarBoleta(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const boletaId = String(formData.get("boletaId") ?? "");
  const batchId = String(formData.get("batchId") ?? "");

  await withUser(userId, async (tx) => {
    const [batch] = await tx
      .select()
      .from(schema.batches)
      .where(and(eq(schema.batches.id, batchId), eq(schema.batches.userId, userId)));

    if (!batch) throw new Error("Batch no encontrado");

    await tx
      .update(schema.boletas)
      .set({ status: "pending", errorMessage: null, updatedAt: new Date() })
      .where(and(eq(schema.boletas.id, boletaId), eq(schema.boletas.batchId, batchId)));

    await tx
      .update(schema.batches)
      .set({ status: "pending", errorMessage: null, finishedAt: null })
      .where(eq(schema.batches.id, batchId));
  });

  redirect("/dashboard/emisiones");
}

export default async function EmisionesPage() {
  const userId = await requireUserId();

  const { filas, boletasPorBatch } = await withUser(userId, async (tx) => {
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
      .where(eq(schema.batches.userId, userId))
      .orderBy(desc(schema.batches.createdAt));

    const boletasTodas = filas.length
      ? await tx.select().from(schema.boletas).where(inArray(schema.boletas.batchId, filas.map((f) => f.batchId)))
      : [];

    const boletasPorBatch = new Map<string, typeof boletasTodas>();
    for (const b of boletasTodas) {
      const arr = boletasPorBatch.get(b.batchId) ?? [];
      arr.push(b);
      boletasPorBatch.set(b.batchId, arr);
    }

    return { filas, boletasPorBatch };
  });

  const archivos = filas.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    boletas: boletasPorBatch.get(f.batchId) ?? [],
  }));

  const hayTrabajoEnProceso = archivos.some((b) => b.batchStatus === "pending" || b.batchStatus === "running");

  return (
    <div className="fade-in mx-auto max-w-7xl p-4 md:p-8">
      <AutoRefresh activo={hayTrabajoEnProceso} />

      <div className="mb-6 flex items-center justify-between border-b border-border pb-5">
        <h1 className="text-page">Emisiones</h1>
        <a
          href="/dashboard/emisiones/nueva"
          className="btn-primary rounded-md px-4 py-2 text-sm"
        >
          + Nueva emisión
        </a>
      </div>

      {archivos.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted">
          Aún no has subido ningún CSV.{" "}
          <a href="/dashboard/emisiones/nueva" className="font-medium text-accent transition-colors hover:text-accent-hover">
            Sube el primero
          </a>
          .
        </p>
      ) : (
        <EmisionesExplorer archivos={archivos} reintentarAction={reintentarBoleta} />
      )}
    </div>
  );
}
