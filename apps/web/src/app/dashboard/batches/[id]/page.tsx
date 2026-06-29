import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db, withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { auth } from "@/auth";
import { registrarEvento } from "@/lib/auditoria";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ESTADO_BOLETA_LABEL, ESTADO_BOLETA_BADGE } from "@/lib/estados";

async function actorEmailActual(): Promise<string> {
  const session = await auth();
  return session?.user?.email ?? "";
}

const ESTADO_LABEL = ESTADO_BOLETA_LABEL;

const TIPO_BOLETA_LABEL: Record<string, string> = {
  exenta: "Boleta exenta",
  afecta: "Boleta afecta",
};

const METODO_PAGO_LABEL: Record<string, string> = {
  debito: "Débito",
  credito: "Crédito",
  efectivo: "Efectivo",
  otro: "Otro",
};

const ESTADO_BADGE = ESTADO_BOLETA_BADGE;

async function obtenerContextoBatch(tx: typeof db, userId: string, batchId: string) {
  const [fila] = await tx
    .select({
      csvFilename: schema.batches.csvFilename,
      emisorRazonSocial: schema.siiCredentials.emisorRazonSocial,
      emisorRut: schema.siiCredentials.emisorRut,
    })
    .from(schema.batches)
    .innerJoin(schema.siiCredentials, eq(schema.batches.siiCredentialId, schema.siiCredentials.id))
    .where(and(eq(schema.batches.id, batchId), eq(schema.batches.userId, userId)));
  return fila;
}

async function reintentarBoleta(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const actorEmail = await actorEmailActual();
  const boletaId = String(formData.get("boletaId") ?? "");
  const batchId = String(formData.get("batchId") ?? "");

  await withUser(userId, async (tx) => {
    const contexto = await obtenerContextoBatch(tx, userId, batchId);
    if (!contexto) throw new Error("Batch no encontrado");

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
      razonSocialSnapshot: contexto.emisorRazonSocial,
      rutSnapshot: contexto.emisorRut,
      descripcion: `Reintentó boleta de ${boleta?.nombre ?? "—"} en ${contexto.csvFilename}`,
      detalle: { batchId, csvFilename: contexto.csvFilename },
    });
  });

  redirect(`/dashboard/batches/${batchId}`);
}

async function confirmarBatch(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const actorEmail = await actorEmailActual();
  const batchId = String(formData.get("batchId") ?? "");

  await withUser(userId, async (tx) => {
    const contexto = await obtenerContextoBatch(tx, userId, batchId);

    await tx
      .update(schema.batches)
      .set({ status: "pending" })
      .where(and(eq(schema.batches.id, batchId), eq(schema.batches.userId, userId), eq(schema.batches.status, "borrador")));

    if (contexto) {
      await registrarEvento(tx, {
        userId,
        actorEmail,
        tipo: "batch_confirmado",
        entidadId: batchId,
        razonSocialSnapshot: contexto.emisorRazonSocial,
        rutSnapshot: contexto.emisorRut,
        descripcion: `Confirmó la emisión de "${contexto.csvFilename}" para ${contexto.emisorRazonSocial ?? contexto.emisorRut}`,
      });
    }
  });

  redirect(`/dashboard/batches/${batchId}`);
}

async function cancelarBatch(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const actorEmail = await actorEmailActual();
  const batchId = String(formData.get("batchId") ?? "");

  await withUser(userId, async (tx) => {
    const contexto = await obtenerContextoBatch(tx, userId, batchId);

    await tx
      .delete(schema.batches)
      .where(and(eq(schema.batches.id, batchId), eq(schema.batches.userId, userId), eq(schema.batches.status, "borrador")));

    if (contexto) {
      await registrarEvento(tx, {
        userId,
        actorEmail,
        tipo: "batch_cancelado",
        entidadId: batchId,
        razonSocialSnapshot: contexto.emisorRazonSocial,
        rutSnapshot: contexto.emisorRut,
        descripcion: `Canceló el borrador "${contexto.csvFilename}" de ${contexto.emisorRazonSocial ?? contexto.emisorRut}`,
      });
    }
  });

  redirect("/dashboard/emisiones");
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

  const hayTrabajoEnProceso = batch.status === "pending" || batch.status === "running";

  return (
    <div className="fade-in mx-auto max-w-2xl p-4 md:p-8">
      <AutoRefresh activo={hayTrabajoEnProceso} />
      <a href="/dashboard/emisiones" className="inline-block rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
        ← Volver
      </a>
      <h1 className="mb-1 mt-2 text-page">{batch.csvFilename}</h1>
      <p className="mb-6 text-sm text-muted">
        {boletas.length} boleta{boletas.length === 1 ? "" : "s"}
      </p>

      {batch.status === "borrador" && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-card border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm text-warning">
            Revisa las {boletas.length} boleta{boletas.length === 1 ? "" : "s"} antes de emitir.
          </p>
          <div className="flex shrink-0 gap-2">
            <form action={cancelarBatch}>
              <input type="hidden" name="batchId" value={batch.id} />
              <button type="submit" className="rounded-md px-3 py-1.5 text-sm text-danger transition-colors hover:bg-surface-2">
                Cancelar
              </button>
            </form>
            <form action={confirmarBatch}>
              <input type="hidden" name="batchId" value={batch.id} />
              <button type="submit" className="btn-primary rounded-md px-3 py-1.5 text-sm">
                Emitir boletas
              </button>
            </form>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {boletas.map((b) => (
          <li
            key={b.id}
            className="glass-panel flex items-center justify-between gap-4 rounded-card p-4 shadow-card"
          >
            <div className="min-w-0">
              <p className="font-medium">{b.nombre}</p>
              <p className="text-sm text-muted">
                <span className="font-medium text-text">${b.monto.toLocaleString("es-CL")}</span> — {TIPO_BOLETA_LABEL[b.tipoBoleta]} — {METODO_PAGO_LABEL[b.metodoPago]}
              </p>
              {b.conDetalle && b.detalle && <p className="text-sm text-muted">Detalle: {b.detalle}</p>}
              {b.conReceptor && (
                <p className="text-sm text-muted">
                  Receptor: {b.receptorNombre} ({b.receptorRut})
                </p>
              )}
              {b.status === "failed" && b.errorMessage && (
                <p className="mt-1 text-sm text-danger">{b.errorMessage}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`rounded-full border px-2.5 py-0.5 text-caption font-medium ${ESTADO_BADGE[b.status]}`}>
                {ESTADO_LABEL[b.status]}
              </span>
              {b.status === "success" && (
                <a href={`/api/batches/${batch.id}/pdf/${b.id}`} className="rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
                  PDF
                </a>
              )}
              {b.status === "failed" && (
                <form action={reintentarBoleta}>
                  <input type="hidden" name="boletaId" value={b.id} />
                  <input type="hidden" name="batchId" value={batch.id} />
                  <button type="submit" className="rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
                    Reintentar
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
