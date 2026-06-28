import { sql } from "drizzle-orm";
import { db } from "@sii-demo/db";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (key !== process.env.AUTH_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nombre text`);

  return new Response("OK: columna users.nombre asegurada");
}
