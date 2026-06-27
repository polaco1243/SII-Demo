import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withUser<T>(userId: string, fn: (tx: typeof db) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(userId)) {
    throw new Error("userId inválido");
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`set local app.current_user_id = '${userId}'`));
    return fn(tx as unknown as typeof db);
  });
}

export { schema };
