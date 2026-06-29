import { db, schema } from "@sii-demo/db";

type Tx = typeof db;
type TipoEvento = (typeof schema.auditEventType.enumValues)[number];

interface RegistrarEventoParams {
  userId: string;
  actorEmail: string;
  tipo: TipoEvento;
  descripcion: string;
  entidadId?: string;
  razonSocialSnapshot?: string | null;
  rutSnapshot?: string | null;
  detalle?: Record<string, unknown>;
}

/** Inserta un evento en la bitácora de auditoría (append-only, nunca se actualiza). */
export async function registrarEvento(tx: Tx, params: RegistrarEventoParams) {
  await tx.insert(schema.auditEvents).values({
    userId: params.userId,
    actorEmail: params.actorEmail,
    tipo: params.tipo,
    descripcion: params.descripcion,
    entidadId: params.entidadId ?? null,
    razonSocialSnapshot: params.razonSocialSnapshot ?? null,
    rutSnapshot: params.rutSnapshot ?? null,
    detalle: params.detalle ?? null,
  });
}
