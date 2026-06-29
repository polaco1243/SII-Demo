import { eq, desc, and, or, ilike, inArray } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";

function csvEscape(valor: unknown): string {
  const texto = String(valor ?? "");
  if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export async function GET(request: Request) {
  const userId = await requireUserId();
  const url = new URL(request.url);
  const vigencia = url.searchParams.get("vigencia") ?? "todas";
  const q = url.searchParams.get("q") ?? "";

  const filas = await withUser(userId, async (tx) => {
    const condiciones = [eq(schema.batches.userId, userId)];
    if (vigencia === "vigentes") condiciones.push(eq(schema.siiCredentials.activa, true));
    if (vigencia === "inactivas") condiciones.push(eq(schema.siiCredentials.activa, false));
    if (q.trim()) {
      const like = `%${q.trim()}%`;
      condiciones.push(
        or(
          ilike(schema.siiCredentials.emisorRazonSocial, like),
          ilike(schema.siiCredentials.emisorRut, like),
          ilike(schema.batches.csvFilename, like),
        )!,
      );
    }

    const batches = await tx
      .select({
        batchId: schema.batches.id,
        csvFilename: schema.batches.csvFilename,
        batchStatus: schema.batches.status,
        createdAt: schema.batches.createdAt,
        emisorRut: schema.siiCredentials.emisorRut,
        emisorRazonSocial: schema.siiCredentials.emisorRazonSocial,
        credencialActiva: schema.siiCredentials.activa,
      })
      .from(schema.batches)
      .innerJoin(schema.siiCredentials, eq(schema.batches.siiCredentialId, schema.siiCredentials.id))
      .where(and(...condiciones))
      .orderBy(desc(schema.batches.createdAt));

    const boletas = batches.length
      ? await tx.select().from(schema.boletas).where(inArray(schema.boletas.batchId, batches.map((b) => b.batchId)))
      : [];

    const boletasPorBatch = new Map<string, typeof boletas>();
    for (const b of boletas) {
      const arr = boletasPorBatch.get(b.batchId) ?? [];
      arr.push(b);
      boletasPorBatch.set(b.batchId, arr);
    }

    return batches.flatMap((batch) =>
      (boletasPorBatch.get(batch.batchId) ?? []).map((b) => ({
        razonSocial: batch.emisorRazonSocial ?? "",
        rutEmisor: batch.emisorRut ?? "",
        vigente: batch.credencialActiva ? "Sí" : "No",
        archivo: batch.csvFilename,
        fechaArchivo: batch.createdAt.toISOString(),
        estadoArchivo: batch.batchStatus,
        cliente: b.nombre,
        monto: b.monto,
        tipoBoleta: b.tipoBoleta,
        metodoPago: b.metodoPago,
        estadoBoleta: b.status,
        error: b.errorMessage ?? "",
      })),
    );
  });

  const encabezado = [
    "Razón social",
    "RUT emisor",
    "Vigente",
    "Archivo",
    "Fecha archivo",
    "Estado archivo",
    "Cliente",
    "Monto",
    "Tipo boleta",
    "Método pago",
    "Estado boleta",
    "Error",
  ];

  const lineas = [
    encabezado.join(","),
    ...filas.map((f) => Object.values(f).map(csvEscape).join(",")),
  ];

  return new Response(lineas.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="historial-emisiones.csv"`,
    },
  });
}
