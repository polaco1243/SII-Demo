import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIR = process.env.DESCARGAS_DIR ?? "/data/descargas";

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  try {
    if (!file) {
      // Listar artefactos de debug, más reciente primero
      const todos = await readdir(DIR);
      const debug = todos
        .filter((f) => (f.startsWith("debug_") || f.startsWith("explor_")) && /\.(png|html|txt)$/.test(f))
        .sort()
        .reverse();
      return NextResponse.json({ files: debug });
    }
    const nombre = path.basename(file);
    const buf = await readFile(path.join(DIR, nombre));
    const tipo = nombre.endsWith(".png")
      ? "image/png"
      : nombre.endsWith(".html")
        ? "text/html; charset=utf-8"
        : "text/plain; charset=utf-8";
    return new NextResponse(buf as never, { headers: { "Content-Type": tipo } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
