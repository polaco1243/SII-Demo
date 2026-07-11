import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "node:fs";
import { eq, and } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; facturaId: string }> },
) {
  const { id, facturaId } = await params;
  const userId = await requireUserId();

  const factura = await withUser(userId, async (tx) => {
    const [batch] = await tx
      .select()
      .from(schema.batches)
      .where(and(eq(schema.batches.id, id), eq(schema.batches.userId, userId)));

    if (!batch) return null;

    const [factura] = await tx
      .select()
      .from(schema.facturas)
      .where(and(eq(schema.facturas.id, facturaId), eq(schema.facturas.batchId, id)));

    return factura ?? null;
  });

  if (!factura || !factura.pdfPath || !existsSync(factura.pdfPath)) {
    return NextResponse.json({ error: "PDF no encontrado" }, { status: 404 });
  }

  const stream = createReadStream(factura.pdfPath);
  return new NextResponse(stream as never, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura_${factura.facturaRef}.pdf"`,
    },
  });
}
