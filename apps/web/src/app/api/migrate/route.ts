import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function POST() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Migración 0008: agregar 'transferencia' al enum metodo_pago
    await pool.query(`ALTER TYPE "public"."metodo_pago" ADD VALUE IF NOT EXISTS 'transferencia'`);
    return NextResponse.json({ ok: true, message: "Migración 0008 aplicada" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    await pool.end();
  }
}
