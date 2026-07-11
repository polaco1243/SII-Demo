import "dotenv/config";
import { eq, asc, and, ne } from "drizzle-orm";
import { db, schema } from "@sii-demo/db";
import { decrypt } from "@sii-demo/crypto";
import { SIIAutomation } from "./automation";
import { SIIFacturaAutomation, type FacturaInput } from "./factura-automation";

const { batches, boletas, facturas, facturaItems, siiCredentials, auditEvents } = schema;

const POLL_INTERVAL_MS = 15_000;
const DESCARGAS_DIR = process.env.DESCARGAS_DIR ?? "/data/descargas";

async function claimNextBatch(tipoDocumento: "boleta" | "factura") {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(batches)
      .where(and(eq(batches.status, "pending"), eq(batches.tipoDocumento, tipoDocumento)))
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

  const exitosas = resultados.filter((r) => r.exito).length;
  const fallidas = resultados.length - exitosas;

  // Evento generado por el sistema (no por una acción humana) — se registra
  // con actorEmail "sistema" para no atribuirle a un usuario algo que no hizo.
  await db.insert(auditEvents).values({
    userId: batch.userId,
    actorEmail: "sistema",
    tipo: "archivo_procesado",
    entidadId: batch.id,
    razonSocialSnapshot: credencial.emisorRazonSocial,
    rutSnapshot: credencial.emisorRut,
    descripcion: `Procesó "${batch.csvFilename}": ${exitosas} exitosa${exitosas === 1 ? "" : "s"}, ${fallidas} fallida${fallidas === 1 ? "" : "s"}`,
    detalle: { csvFilename: batch.csvFilename, exitosas, fallidas },
  });
}

async function processFacturaBatch(batch: typeof schema.batches.$inferSelect) {
  const [credencial] = await db
    .select()
    .from(siiCredentials)
    .where(eq(siiCredentials.id, batch.siiCredentialId))
    .limit(1);

  if (!credencial || !credencial.emisorRazonSocial) {
    await db
      .update(batches)
      .set({ status: "failed", errorMessage: "Credencial SII sin emisor confirmado", finishedAt: new Date() })
      .where(eq(batches.id, batch.id));
    return;
  }

  const cabeceras = await db
    .select()
    .from(facturas)
    .where(and(eq(facturas.batchId, batch.id), ne(facturas.status, "success")));

  const itemsPorFactura = new Map<string, (typeof facturaItems.$inferSelect)[]>();
  for (const cabecera of cabeceras) {
    const items = await db
      .select()
      .from(facturaItems)
      .where(eq(facturaItems.facturaId, cabecera.id))
      .orderBy(asc(facturaItems.orden));
    itemsPorFactura.set(cabecera.id, items);
  }

  const clave = decrypt(credencial.claveEncrypted);
  const automation = new SIIFacturaAutomation(credencial.rut, clave, DESCARGAS_DIR, true);

  const facturasParaEmitir: FacturaInput[] = cabeceras.map((c) => ({
    facturaRef: c.facturaRef,
    receptorRut: c.receptorRut,
    receptorDv: c.receptorDv,
    receptorRazonSocial: c.receptorRazonSocial,
    receptorTipoCompra: c.receptorTipoCompra,
    receptorDireccion: c.receptorDireccion,
    receptorComuna: c.receptorComuna,
    receptorCiudad: c.receptorCiudad,
    receptorGiro: c.receptorGiro,
    receptorContacto: c.receptorContacto,
    rutSolicita: c.rutSolicita,
    dvSolicita: c.dvSolicita,
    rutTransporte: c.rutTransporte,
    dvTransporte: c.dvTransporte,
    patente: c.patente,
    rutChofer: c.rutChofer,
    dvChofer: c.dvChofer,
    nombreChofer: c.nombreChofer,
    formaPago: c.formaPago,
    pctDescuentoGlobal: c.pctDescuentoGlobal,
    items: (itemsPorFactura.get(c.id) ?? []).map((i) => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      unidad: i.unidad,
      precio: i.precio,
      pctDescuento: i.pctDescuento,
    })),
  }));

  const resultados =
    process.env.SIMULAR_SII === "true"
      ? await automation.runBatchSimulado(facturasParaEmitir)
      : await automation.runBatch(credencial.emisorRazonSocial, facturasParaEmitir);

  let huboFallo = false;
  for (let i = 0; i < cabeceras.length; i++) {
    const cabecera = cabeceras[i];
    const resultado = resultados[i];
    if (resultado.exito) {
      await db
        .update(facturas)
        .set({ status: "success", folio: resultado.folio ?? null, pdfPath: resultado.pdfPath, updatedAt: new Date() })
        .where(eq(facturas.id, cabecera.id));
    } else {
      huboFallo = true;
      await db
        .update(facturas)
        .set({ status: "failed", errorMessage: resultado.error, updatedAt: new Date() })
        .where(eq(facturas.id, cabecera.id));
    }
  }

  await db
    .update(batches)
    .set({ status: huboFallo ? "failed" : "done", finishedAt: new Date() })
    .where(eq(batches.id, batch.id));

  const exitosas = resultados.filter((r) => r.exito).length;
  const fallidas = resultados.length - exitosas;

  await db.insert(auditEvents).values({
    userId: batch.userId,
    actorEmail: "sistema",
    tipo: "archivo_procesado",
    entidadId: batch.id,
    razonSocialSnapshot: credencial.emisorRazonSocial,
    rutSnapshot: credencial.emisorRut,
    descripcion: `Procesó "${batch.csvFilename}": ${exitosas} factura${exitosas === 1 ? "" : "s"} exitosa${exitosas === 1 ? "" : "s"}, ${fallidas} fallida${fallidas === 1 ? "" : "s"}`,
    detalle: { csvFilename: batch.csvFilename, exitosas, fallidas },
  });
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
    const batch = await claimNextBatch("boleta");
    if (batch) {
      console.log(`Procesando batch ${batch.id}`);
      await processBatch(batch);
      console.log(`Batch ${batch.id} terminado`);
    }
  } catch (err) {
    console.error("Error procesando batch:", err);
  }

  try {
    const batch = await claimNextBatch("factura");
    if (batch) {
      console.log(`Procesando batch de facturas ${batch.id}`);
      await processFacturaBatch(batch);
      console.log(`Batch de facturas ${batch.id} terminado`);
    }
  } catch (err) {
    console.error("Error procesando batch de facturas:", err);
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
