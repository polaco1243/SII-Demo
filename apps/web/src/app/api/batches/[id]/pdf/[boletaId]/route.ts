import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "node:fs";
import { eq, and } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; boletaId: string }> },
) {
  const { id, boletaId } = await params;
  const userId = await requireUserId();

  const boleta = await withUser(userId, async (tx) => {
    const [batch] = await tx
      .select()
      .from(schema.batches)
      .where(and(eq(schema.batches.id, id), eq(schema.batches.userId, userId)));

    if (!batch) return null;

    const [boleta] = await tx
      .select()
      .from(schema.boletas)
      .where(and(eq(schema.boletas.id, boletaId), eq(schema.boletas.batchId, id)));

    return boleta ?? null;
  });

  if (!boleta || !boleta.pdfPath || !existsSync(boleta.pdfPath)) {
    return NextResponse.json({ error: "PDF no encontrado" }, { status: 404 });
  }

  const stream = createReadStream(boleta.pdfPath);
  return new NextResponse(stream as never, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="boleta_${boleta.nombre}.pdf"`,
    },
  });
}
