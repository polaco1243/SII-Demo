import { pgTable, uuid, text, integer, timestamp, pgEnum, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const batchStatus = pgEnum("batch_status", ["borrador", "pending", "running", "done", "failed"]);
export const boletaStatus = pgEnum("boleta_status", ["pending", "success", "failed"]);
export const credentialStatus = pgEnum("credential_status", [
  "pendiente",
  "descubriendo",
  "pendiente_seleccion",
  "lista",
  "error",
]);
export const tipoBoletaEnum = pgEnum("tipo_boleta", ["exenta", "afecta"]);
export const metodoPagoEnum = pgEnum("metodo_pago", ["debito", "credito", "efectivo", "otro", "transferencia"]);
export const auditEventType = pgEnum("audit_event_type", [
  "credencial_agregada",
  "credencial_confirmada",
  "credencial_eliminada",
  "credencial_clave_actualizada",
  "csv_subido",
  "batch_confirmado",
  "batch_cancelado",
  "boleta_reintentada",
  "archivo_procesado",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nombre: text("nombre"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siiCredentials = pgTable("sii_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rut: text("rut").notNull(),
  claveEncrypted: text("clave_encrypted").notNull(),
  emisor: text("emisor"),
  emisorRut: text("emisor_rut"),
  emisorRazonSocial: text("emisor_razon_social"),
  emisoresDisponibles: jsonb("emisores_disponibles").$type<string[]>(),
  status: credentialStatus("status").notNull().default("pendiente"),
  errorMessage: text("error_message"),
  activa: boolean("activa").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  siiCredentialId: uuid("sii_credential_id").notNull().references(() => siiCredentials.id, { onDelete: "restrict" }),
  csvFilename: text("csv_filename").notNull(),
  status: batchStatus("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const boletas = pgTable("boletas", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),

  rutContribuyente: text("rut_contribuyente").notNull(),
  nombreCliente: text("nombre_cliente").notNull(),
  rutCliente1: text("rut_cliente1").notNull(),

  nombre: text("nombre").notNull(),
  monto: integer("monto").notNull(),
  tipoBoleta: tipoBoletaEnum("tipo_boleta").notNull(),
  metodoPago: metodoPagoEnum("metodo_pago").notNull(),

  conReceptor: boolean("con_receptor").notNull().default(false),
  receptorRut: text("receptor_rut"),
  receptorNombre: text("receptor_nombre"),
  receptorDireccion: text("receptor_direccion"),
  receptorEmail: text("receptor_email"),
  receptorTelefono: text("receptor_telefono"),

  conDetalle: boolean("con_detalle").notNull().default(false),
  detalle: text("detalle"),

  email: text("email"),
  status: boletaStatus("status").notNull().default("pending"),
  pdfPath: text("pdf_path"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Bitácora de auditoría: append-only, nunca se actualiza ni se borra.
// entidadId NO lleva foreign key a propósito — un evento debe seguir
// siendo legible aunque la credencial/batch referenciado deje de existir
// (la entidad afectada se puede dar de baja, pero la auditoría es permanente).
// Por eso cada evento guarda su propio snapshot de texto (razonSocialSnapshot,
// rutSnapshot, descripcion) en vez de depender de un JOIN a datos mutables.
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorEmail: text("actor_email").notNull(),
  tipo: auditEventType("tipo").notNull(),
  entidadId: uuid("entidad_id"),
  razonSocialSnapshot: text("razon_social_snapshot"),
  rutSnapshot: text("rut_snapshot"),
  descripcion: text("descripcion").notNull(),
  detalle: jsonb("detalle").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  siiCredentials: many(siiCredentials),
  batches: many(batches),
}));

export const siiCredentialsRelations = relations(siiCredentials, ({ one, many }) => ({
  user: one(users, { fields: [siiCredentials.userId], references: [users.id] }),
  batches: many(batches),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  user: one(users, { fields: [batches.userId], references: [users.id] }),
  siiCredential: one(siiCredentials, { fields: [batches.siiCredentialId], references: [siiCredentials.id] }),
  boletas: many(boletas),
}));

export const boletasRelations = relations(boletas, ({ one }) => ({
  batch: one(batches, { fields: [boletas.batchId], references: [batches.id] }),
}));
