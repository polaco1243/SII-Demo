import { eq, and, desc, gte, lte } from "drizzle-orm";
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
  const razonSocial = url.searchParams.get("razonSocial") ?? "";
  const tipo = url.searchParams.get("tipo") ?? "";
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";

  const eventos = await withUser(userId, async (tx) => {
    const condiciones = [eq(schema.auditEvents.userId, userId)];
    if (razonSocial) condiciones.push(eq(schema.auditEvents.razonSocialSnapshot, razonSocial));
    if (tipo) condiciones.push(eq(schema.auditEvents.tipo, tipo as (typeof schema.auditEventType.enumValues)[number]));
    if (desde) condiciones.push(gte(schema.auditEvents.createdAt, new Date(desde)));
    if (hasta) {
      const hastaFin = new Date(hasta);
      hastaFin.setHours(23, 59, 59, 999);
      condiciones.push(lte(schema.auditEvents.createdAt, hastaFin));
    }

    return tx
      .select()
      .from(schema.auditEvents)
      .where(and(...condiciones))
      .orderBy(desc(schema.auditEvents.createdAt));
  });

  const encabezado = ["Fecha y hora", "Usuario", "Tipo de evento", "Razón social", "RUT", "Descripción"];
  const lineas = [
    encabezado.join(","),
    ...eventos.map((e) =>
      [e.createdAt.toISOString(), e.actorEmail, e.tipo, e.razonSocialSnapshot ?? "", e.rutSnapshot ?? "", e.descripcion]
        .map(csvEscape)
        .join(","),
    ),
  ];

  return new Response(lineas.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bitacora-auditoria.csv"`,
    },
  });
}
