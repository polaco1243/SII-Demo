import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "@sii-demo/db";

const PDF_FALSO = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>",
);

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [credencialOrigen] = await db
    .select()
    .from(schema.siiCredentials)
    .where(eq(schema.siiCredentials.status, "lista"))
    .limit(1);

  if (!credencialOrigen) {
    return NextResponse.json({ error: "no hay credenciales lista para copiar" }, { status: 400 });
  }

  const [batchOrigen] = await db
    .select()
    .from(schema.batches)
    .where(eq(schema.batches.userId, credencialOrigen.userId))
    .orderBy(desc(schema.batches.createdAt))
    .limit(1);

  if (!batchOrigen) {
    return NextResponse.json({ error: "no hay batches para copiar" }, { status: 400 });
  }

  const boletasOrigen = await db.select().from(schema.boletas).where(eq(schema.boletas.batchId, batchOrigen.id));

  const [nuevaCredencial] = await db
    .insert(schema.siiCredentials)
    .values({
      userId: credencialOrigen.userId,
      rut: credencialOrigen.rut,
      claveEncrypted: credencialOrigen.claveEncrypted,
      emisor: "77.081.525-8 ELECTRISAFE",
      emisorRut: "77.081.525-8",
      emisorRazonSocial: "Electrisafe",
      status: "lista",
    })
    .returning();

  const [nuevoBatch] = await db
    .insert(schema.batches)
    .values({
      userId: credencialOrigen.userId,
      siiCredentialId: nuevaCredencial.id,
      csvFilename: "electrisafe_demo.csv",
      status: batchOrigen.status,
    })
    .returning();

  const descargasDir = process.env.DESCARGAS_DIR ?? "/data/descargas";

  for (const b of boletasOrigen) {
    let pdfPath: string | null = null;
    if (b.status === "success") {
      pdfPath = `${descargasDir}/electrisafe_${b.nombre.replace(/\s+/g, "_")}.pdf`;
      await writeFile(pdfPath, PDF_FALSO);
    }
    await db.insert(schema.boletas).values({
      batchId: nuevoBatch.id,
      rutContribuyente: "77.081.525-8",
      nombreCliente: b.nombreCliente,
      rutCliente1: b.rutCliente1,
      nombre: b.nombre,
      monto: b.monto,
      tipoBoleta: b.tipoBoleta,
      metodoPago: b.metodoPago,
      conReceptor: b.conReceptor,
      receptorRut: b.receptorRut,
      receptorNombre: b.receptorNombre,
      receptorDireccion: b.receptorDireccion,
      receptorEmail: b.receptorEmail,
      receptorTelefono: b.receptorTelefono,
      conDetalle: b.conDetalle,
      detalle: b.detalle,
      email: b.email,
      status: b.status,
      pdfPath,
      errorMessage: b.errorMessage,
    });
  }

  return NextResponse.json({ ok: true, batchId: nuevoBatch.id, boletas: boletasOrigen.length });
}
