import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";

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

  return (
    <main className="mx-auto mt-12 max-w-2xl p-6">
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
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
