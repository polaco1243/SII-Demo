import "dotenv/config";
import { eq, asc, and, ne } from "drizzle-orm";
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

  if (!credencial || !credencial.emisor) {
    await db
      .update(batches)
      .set({ status: "failed", errorMessage: "Credencial SII sin emisor confirmado", finishedAt: new Date() })
      .where(eq(batches.id, batch.id));
    return;
  }

  const filas = await db
    .select()
    .from(boletas)
    .where(and(eq(boletas.batchId, batch.id), ne(boletas.status, "success")));

  const clave = decrypt(credencial.claveEncrypted);
  const automation = new SIIAutomation(credencial.rut, clave, DESCARGAS_DIR, true);

  const filasParaEmitir = filas.map((f) => ({
      nombre: f.nombre,
      monto: f.monto,
      tipoBoleta: f.tipoBoleta,
      metodoPago: f.metodoPago,
      conReceptor: f.conReceptor,
      receptorRut: f.receptorRut,
      receptorNombre: f.receptorNombre,
      receptorDireccion: f.receptorDireccion,
      receptorEmail: f.receptorEmail,
      receptorTelefono: f.receptorTelefono,
      conDetalle: f.conDetalle,
      detalle: f.detalle,
      email: f.email,
  }));

  const resultados =
    process.env.SIMULAR_SII === "true"
      ? await automation.runBatchSimulado(filasParaEmitir)
      : await automation.runBatch(credencial.emisor, filasParaEmitir);

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

async function claimNextCredentialDiscovery() {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(siiCredentials)
      .where(and(eq(siiCredentials.status, "pendiente"), eq(siiCredentials.activa, true)))
      .orderBy(asc(siiCredentials.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    const credencial = rows[0];
    if (!credencial) return null;

    await tx.update(siiCredentials).set({ status: "descubriendo" }).where(eq(siiCredentials.id, credencial.id));
    return credencial;
  });
}

async function processCredentialDiscovery(credencial: typeof schema.siiCredentials.$inferSelect) {
  const clave = decrypt(credencial.claveEncrypted);
  const automation = new SIIAutomation(credencial.rut, clave, DESCARGAS_DIR, true);

  try {
    const opciones = await automation.descubrirEmisores();
    if (opciones.length === 0) {
      await db
        .update(siiCredentials)
        .set({ status: "error", errorMessage: "No se encontraron emisores asociados a este RUT", updatedAt: new Date() })
        .where(eq(siiCredentials.id, credencial.id));
      return;
    }
    await db
      .update(siiCredentials)
      .set({ status: "pendiente_seleccion", emisoresDisponibles: opciones, updatedAt: new Date() })
      .where(eq(siiCredentials.id, credencial.id));
  } catch (err) {
    await db
      .update(siiCredentials)
      .set({
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(siiCredentials.id, credencial.id));
  }
}

async function tick() {
  try {
    const batch = await claimNextBatch();
    if (batch) {
      console.log(`Procesando batch ${batch.id}`);
      await processBatch(batch);
      console.log(`Batch ${batch.id} terminado`);
    }
  } catch (err) {
    console.error("Error procesando batch:", err);
  }

  try {
    const credencial = await claimNextCredentialDiscovery();
    if (credencial) {
      console.log(`Descubriendo emisores para credencial ${credencial.id}`);
      await processCredentialDiscovery(credencial);
      console.log(`Credencial ${credencial.id} procesada`);
    }
  } catch (err) {
    console.error("Error descubriendo emisores:", err);
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
