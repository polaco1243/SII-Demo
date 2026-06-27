import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { AutoRefresh } from "@/components/AutoRefresh";

const ESTADO_LABEL: Record<string, string> = {
  pending: "Pendiente",
  success: "Emitida",
  failed: "Falló",
};

const ESTADO_COLOR: Record<string, string> = {
  pending: "#eaeaea",
  success: "#4ade80",
  failed: "#f87171",
};

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

  redirect(`/dashboard/batches/${batchId}`);
}

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();

  const { batch, boletas } = await withUser(userId, async (tx) => {
    const [batch] = await tx
      .select()
      .from(schema.batches)
      .where(and(eq(schema.batches.id, id), eq(schema.batches.userId, userId)));

    if (!batch) return { batch: null, boletas: [] };

    const boletas = await tx.select().from(schema.boletas).where(eq(schema.boletas.batchId, id));
    return { batch, boletas };
  });

  if (!batch) notFound();

  const hayTrabajoEnProceso =
    batch.status === "pending" || batch.status === "running" || boletas.some((b) => b.status === "pending");

  return (
    <main className="mx-auto mt-12 max-w-2xl p-6">
      <AutoRefresh activo={hayTrabajoEnProceso} />
      <a href="/dashboard" className="text-sm text-[#3282b8]">
        ← Volver
      </a>
      <h1 className="mb-6 mt-2 text-xl font-semibold">{batch.csvFilename}</h1>

      <ul className="flex flex-col gap-2">
        {boletas.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between rounded-md border border-[#1f3460] bg-[#16213e] p-3"
          >
            <div>
              <p className="font-medium">{b.nombre}</p>
              <p className="text-sm">
                ${b.monto.toLocaleString("es-CL")} — {b.detalle}
              </p>
              {b.status === "failed" && b.errorMessage && (
                <p className="text-sm text-[#f87171]">{b.errorMessage}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span style={{ color: ESTADO_COLOR[b.status] }}>{ESTADO_LABEL[b.status]}</span>
              {b.status === "success" && (
                <a href={`/api/batches/${batch.id}/pdf/${b.id}`} className="text-[#3282b8]">
                  PDF
                </a>
              )}
              {b.status === "failed" && (
                <form action={reintentarBoleta}>
                  <input type="hidden" name="boletaId" value={b.id} />
                  <input type="hidden" name="batchId" value={batch.id} />
                  <button type="submit" className="text-[#3282b8]">
                    Reintentar
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
