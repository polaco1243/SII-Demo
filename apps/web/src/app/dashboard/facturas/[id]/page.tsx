import { notFound, redirect } from "next/navigation";
import { eq, and, asc } from "drizzle-orm";
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
const ESTADO_BADGE = ESTADO_BOLETA_BADGE;

const FORMA_PAGO_LABEL: Record<string, string> = {
  contado: "Contado",
  credito: "Crédito",
  sin_costo: "Sin costo",
};

function formatCLP(monto: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(monto);
}

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

async function reintentarFactura(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const actorEmail = await actorEmailActual();
  const facturaId = String(formData.get("facturaId") ?? "");
  const batchId = String(formData.get("batchId") ?? "");

  await withUser(userId, async (tx) => {
    const contexto = await obtenerContextoBatch(tx, userId, batchId);
    if (!contexto) throw new Error("Batch no encontrado");

    const [factura] = await tx.select().from(schema.facturas).where(eq(schema.facturas.id, facturaId));

    await tx
      .update(schema.facturas)
      .set({ status: "pending", errorMessage: null, updatedAt: new Date() })
      .where(and(eq(schema.facturas.id, facturaId), eq(schema.facturas.batchId, batchId)));

    await tx
      .update(schema.batches)
      .set({ status: "pending", errorMessage: null, finishedAt: null })
      .where(eq(schema.batches.id, batchId));

    await registrarEvento(tx, {
      userId,
      actorEmail,
      tipo: "factura_reintentada",
      entidadId: facturaId,
      razonSocialSnapshot: contexto.emisorRazonSocial,
      rutSnapshot: contexto.emisorRut,
      descripcion: `Reintentó factura ${factura?.facturaRef ?? "—"} en ${contexto.csvFilename}`,
      detalle: { batchId, csvFilename: contexto.csvFilename },
    });
  });

  redirect(`/dashboard/facturas/${batchId}`);
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

  redirect(`/dashboard/facturas/${batchId}`);
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

  redirect("/dashboard/facturas");
}

export default async function FacturaBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();

  const { batch, facturas } = await withUser(userId, async (tx) => {
    const [batch] = await tx
      .select()
      .from(schema.batches)
      .where(and(eq(schema.batches.id, id), eq(schema.batches.userId, userId), eq(schema.batches.tipoDocumento, "factura")));

    if (!batch) return { batch: null, facturas: [] };

    const cabeceras = await tx.select().from(schema.facturas).where(eq(schema.facturas.batchId, id));
    const facturas = await Promise.all(
      cabeceras.map(async (c) => {
        const items = await tx
          .select()
          .from(schema.facturaItems)
          .where(eq(schema.facturaItems.facturaId, c.id))
          .orderBy(asc(schema.facturaItems.orden));
        return { ...c, items };
      }),
    );
    return { batch, facturas };
  });

  if (!batch) notFound();

  const hayTrabajoEnProceso = batch.status === "pending" || batch.status === "running";

  return (
    <div className="fade-in mx-auto max-w-2xl p-4 md:p-8">
      <AutoRefresh activo={hayTrabajoEnProceso} />
      <a href="/dashboard/facturas" className="inline-block rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
        ← Volver
      </a>
      <h1 className="mb-1 mt-2 text-page">{batch.csvFilename}</h1>
      <p className="mb-6 text-sm text-muted">
        {facturas.length} factura{facturas.length === 1 ? "" : "s"}
      </p>

      {batch.status === "borrador" && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-card border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm text-warning">
            Revisa las {facturas.length} factura{facturas.length === 1 ? "" : "s"} antes de emitir.
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
                Emitir facturas
              </button>
            </form>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {facturas.map((f) => (
          <li key={f.id} className="glass-panel flex flex-col gap-2 rounded-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{f.facturaRef}</p>
                <p className="text-sm text-muted">
                  Receptor: {f.receptorRazonSocial} ({f.receptorRut}-{f.receptorDv})
                </p>
                <p className="text-sm text-muted">
                  <span className="font-medium text-text">{formatCLP(f.montoTotal)}</span> — {FORMA_PAGO_LABEL[f.formaPago]}
                  {f.folio && <> — Folio {f.folio}</>}
                </p>
                {f.status === "failed" && f.errorMessage && <p className="mt-1 text-sm text-danger">{f.errorMessage}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`rounded-full border px-2.5 py-0.5 text-caption font-medium ${ESTADO_BADGE[f.status]}`}>
                  {ESTADO_LABEL[f.status]}
                </span>
                {f.status === "success" && (
                  <a href={`/api/facturas/${batch.id}/pdf/${f.id}`} className="rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
                    PDF
                  </a>
                )}
                {f.status === "failed" && (
                  <form action={reintentarFactura}>
                    <input type="hidden" name="facturaId" value={f.id} />
                    <input type="hidden" name="batchId" value={batch.id} />
                    <button type="submit" className="rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
                      Reintentar
                    </button>
                  </form>
                )}
              </div>
            </div>
            <ul className="ml-1 flex flex-col gap-0.5 border-l border-border pl-3 text-xs text-muted">
              {f.items.map((item) => (
                <li key={item.id}>
                  {item.cantidad} {item.unidad ?? ""} × {item.nombre} — {formatCLP(item.subtotal)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
