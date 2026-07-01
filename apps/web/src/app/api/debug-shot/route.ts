import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIR = process.env.DESCARGAS_DIR ?? "/data/descargas";

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  try {
    if (!file) {
      // Listar screenshots de debug, más reciente primero
      const todos = await readdir(DIR);
      const debug = todos.filter((f) => f.startsWith("debug_") && f.endsWith(".png")).sort().reverse();
      return NextResponse.json({ files: debug });
    }
    const buf = await readFile(path.join(DIR, path.basename(file)));
    return new NextResponse(buf as never, {
      headers: { "Content-Type": "image/png" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
