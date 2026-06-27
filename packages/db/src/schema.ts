import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const batchStatus = pgEnum("batch_status", ["pending", "running", "done", "failed"]);
export const boletaStatus = pgEnum("boleta_status", ["pending", "success", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siiCredentials = pgTable("sii_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rut: text("rut").notNull(),
  claveEncrypted: text("clave_encrypted").notNull(),
  emisor: text("emisor").notNull(),
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
  nombre: text("nombre").notNull(),
  monto: integer("monto").notNull(),
  detalle: text("detalle").notNull(),
  email: text("email"),
  status: boletaStatus("status").notNull().default("pending"),
  pdfPath: text("pdf_path"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
