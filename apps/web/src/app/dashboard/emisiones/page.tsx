import { redirect } from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { auth } from "@/auth";
import { registrarEvento } from "@/lib/auditoria";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EmisionesExplorer } from "@/components/EmisionesExplorer";
import { EmisionesSubNav } from "@/components/EmisionesSubNav";

async function reintentarBoleta(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const session = await auth();
  const actorEmail = session?.user?.email ?? "";
  const boletaId = String(formData.get("boletaId") ?? "");
  const batchId = String(formData.get("batchId") ?? "");

  await withUser(userId, async (tx) => {
    const [batch] = await tx
      .select({
        csvFilename: schema.batches.csvFilename,
        emisorRazonSocial: schema.siiCredentials.emisorRazonSocial,
        emisorRut: schema.siiCredentials.emisorRut,
      })
      .from(schema.batches)
      .innerJoin(schema.siiCredentials, eq(schema.batches.siiCredentialId, schema.siiCredentials.id))
      .where(and(eq(schema.batches.id, batchId), eq(schema.batches.userId, userId)));

    if (!batch) throw new Error("Batch no encontrado");

    const [boleta] = await tx.select().from(schema.boletas).where(eq(schema.boletas.id, boletaId));

    await tx
      .update(schema.boletas)
      .set({ status: "pending", errorMessage: null, updatedAt: new Date() })
      .where(and(eq(schema.boletas.id, boletaId), eq(schema.boletas.batchId, batchId)));

    await tx
      .update(schema.batches)
      .set({ status: "pending", errorMessage: null, finishedAt: null })
      .where(eq(schema.batches.id, batchId));

    await registrarEvento(tx, {
      userId,
      actorEmail,
      tipo: "boleta_reintentada",
      entidadId: boletaId,
      razonSocialSnapshot: batch.emisorRazonSocial,
      rutSnapshot: batch.emisorRut,
      descripcion: `Reintentó boleta de ${boleta?.nombre ?? "—"} en ${batch.csvFilename}`,
      detalle: { batchId, csvFilename: batch.csvFilename },
    });
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
      .where(and(eq(schema.batches.userId, userId), eq(schema.siiCredentials.activa, true)))
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
      <EmisionesSubNav />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-page">Boletas</h1>
        <a
          href="/dashboard/emisiones/nueva"
          className="btn-primary rounded-md px-4 py-2 text-sm"
        >
          + Nueva boleta
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
