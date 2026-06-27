import "dotenv/config";
import { eq, asc } from "drizzle-orm";
import { db, schema } from "@sii-demo/db";
import { decrypt } from "@sii-demo/crypto";
import { SIIAutomation } from "./automation";

const { batches, boletas, siiCredentials } = schema;

const POLL_INTERVAL_MS = 15_000;
const DESCARGAS_DIR = process.env.DESCARGAS_DIR ?? "/data/descargas";

async function claimNextBatch() {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(batches)
      .where(eq(batches.status, "pending"))
      .orderBy(asc(batches.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    const batch = rows[0];
    if (!batch) return null;

    await tx.update(batches).set({ status: "running" }).where(eq(batches.id, batch.id));
    return batch;
  });
}

async function processBatch(batch: typeof schema.batches.$inferSelect) {
  const [credencial] = await db
    .select()
    .from(siiCredentials)
    .where(eq(siiCredentials.id, batch.siiCredentialId))
    .limit(1);

  if (!credencial) {
    await db
      .update(batches)
      .set({ status: "failed", errorMessage: "Credencial SII no encontrada", finishedAt: new Date() })
      .where(eq(batches.id, batch.id));
    return;
  }

  const filas = await db.select().from(boletas).where(eq(boletas.batchId, batch.id));

  const clave = decrypt(credencial.claveEncrypted);
  const automation = new SIIAutomation(credencial.rut, clave, credencial.emisor, DESCARGAS_DIR, true);

  const resultados = await automation.runBatch(
    filas.map((f) => ({ nombre: f.nombre, monto: f.monto, detalle: f.detalle, email: f.email })),
  );

  let huboFallo = false;
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const resultado = resultados[i];
    if (resultado.exito) {
      await db
        .update(boletas)
        .set({ status: "success", pdfPath: resultado.pdfPath, updatedAt: new Date() })
        .where(eq(boletas.id, fila.id));
    } else {
      huboFallo = true;
      await db
        .update(boletas)
        .set({ status: "failed", errorMessage: resultado.error, updatedAt: new Date() })
        .where(eq(boletas.id, fila.id));
    }
  }

  await db
    .update(batches)
    .set({ status: huboFallo ? "failed" : "done", finishedAt: new Date() })
    .where(eq(batches.id, batch.id));
}

async function tick() {
  try {
    const batch = await claimNextBatch();
    if (!batch) return;
    console.log(`Procesando batch ${batch.id}`);
    await processBatch(batch);
    console.log(`Batch ${batch.id} terminado`);
  } catch (err) {
    console.error("Error procesando batch:", err);
  }
}

async function main() {
  console.log("Worker SII iniciado, polling cada", POLL_INTERVAL_MS, "ms");
  for (;;) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();
