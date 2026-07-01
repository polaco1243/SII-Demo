import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-migrate-key") ?? req.nextUrl.searchParams.get("key");
  if (!key || key !== process.env.MIGRATE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "../../packages/db/migrations") });
    return NextResponse.json({ ok: true, message: "Migraciones aplicadas" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    await pool.end();
  }
}
