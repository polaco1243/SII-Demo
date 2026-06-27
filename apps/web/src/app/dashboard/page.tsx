import { redirect } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { signOut } from "@/auth";
import { AutoRefresh } from "@/components/AutoRefresh";

interface FilaCsv {
  Nombre: string;
  Monto: string;
  Detalle: string;
  Mail: string;
}

const MAX_FILAS_CSV = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarFilas(filas: FilaCsv[]): string | null {
  if (filas.length === 0) return "el archivo no tiene filas";
  if (filas.length > MAX_FILAS_CSV) return `máximo ${MAX_FILAS_CSV} filas por archivo (tiene ${filas.length})`;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numFila = i + 2; // +1 por header, +1 por índice 1-based

    if (!fila.Nombre?.trim()) return `fila ${numFila}: falta el Nombre`;
    if (fila.Nombre.trim().length > 200) return `fila ${numFila}: Nombre muy largo`;

    const monto = Number(fila.Monto);
    if (!fila.Monto || Number.isNaN(monto)) return `fila ${numFila}: Monto inválido`;
    if (!Number.isInteger(monto) || monto <= 0) return `fila ${numFila}: Monto debe ser un entero mayor a 0`;

    if (fila.Mail && !EMAIL_RE.test(fila.Mail.trim())) return `fila ${numFila}: Mail con formato inválido`;
  }

  return null;
}

async function subirCsv(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const siiCredentialId = String(formData.get("siiCredentialId") ?? "");
  const archivo = formData.get("csv") as File | null;

  if (!siiCredentialId || !archivo || archivo.size === 0) {
    redirect("/dashboard?error=faltan_datos");
  }

  const texto = await archivo.text();
  let filas: FilaCsv[];
  try {
    filas = parse(texto, { columns: true, delimiter: ";", trim: true, skip_empty_lines: true });
  } catch {
    redirect("/dashboard?error=" + encodeURIComponent("el archivo no se pudo leer como CSV"));
  }

  const errorValidacion = validarFilas(filas);
  if (errorValidacion) {
    redirect("/dashboard?error=" + encodeURIComponent(errorValidacion));
  }

  await withUser(userId, async (tx) => {
    const [credencial] = await tx
      .select()
      .from(schema.siiCredentials)
      .where(and(eq(schema.siiCredentials.id, siiCredentialId), eq(schema.siiCredentials.userId, userId)));

    if (!credencial) {
      throw new Error("Credencial no encontrada");
    }

    const [batch] = await tx
      .insert(schema.batches)
      .values({ userId, siiCredentialId, csvFilename: archivo.name })
      .returning();

    await tx.insert(schema.boletas).values(
      filas.map((f) => ({
        batchId: batch.id,
        nombre: f.Nombre,
        monto: Math.round(Number(f.Monto)),
        detalle: f.Detalle ?? "",
        email: f.Mail || null,
      })),
    );
  });

  redirect("/dashboard");
}

const ESTADO_LABEL: Record<string, string> = {
  pending: "Pendiente",
  running: "Procesando",
  done: "Completado",
  failed: "Con errores",
};

const ESTADO_COLOR: Record<string, string> = {
  pending: "#eaeaea",
  running: "#3282b8",
  done: "#4ade80",
  failed: "#f87171",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await requireUserId();

  const { credenciales, batches } = await withUser(userId, async (tx) => {
    const credenciales = await tx
      .select()
      .from(schema.siiCredentials)
      .where(
        and(
          eq(schema.siiCredentials.userId, userId),
          eq(schema.siiCredentials.status, "lista"),
          eq(schema.siiCredentials.activa, true),
        ),
      );

    const batches = await tx
      .select()
      .from(schema.batches)
      .where(eq(schema.batches.userId, userId))
      .orderBy(desc(schema.batches.createdAt));

    return { credenciales, batches };
  });

  const hayTrabajoEnProceso = batches.some((b) => b.status === "pending" || b.status === "running");

  return (
    <main className="mx-auto mt-12 max-w-2xl p-6">
      <AutoRefresh activo={hayTrabajoEnProceso} />
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">SII E-Boleta</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-sm text-[#3282b8]">
            Cerrar sesión
          </button>
        </form>
      </div>

      {error === "faltan_datos" && (
        <p className="mb-4 text-sm text-[#f87171]">Selecciona una credencial y un archivo CSV</p>
      )}
      {error && error !== "faltan_datos" && (
        <p className="mb-4 text-sm text-[#f87171]">CSV inválido: {error}</p>
      )}

      <section className="mb-10 rounded-lg border border-[#1f3460] bg-[#16213e] p-6">
        <h2 className="mb-4 font-medium">Nueva emisión por CSV</h2>
        {credenciales.length === 0 ? (
          <p className="text-sm">
            Primero agrega una{" "}
            <a href="/dashboard/credenciales" className="text-[#3282b8]">
              credencial SII
            </a>
            .
          </p>
        ) : (
          <form action={subirCsv} className="flex flex-col gap-4">
            <select
              name="siiCredentialId"
              required
              className="rounded-md border border-[#1f3460] bg-[#1a1a2e] px-3 py-2"
            >
              {credenciales.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emisor} ({c.rut})
                </option>
              ))}
            </select>
            <input name="csv" type="file" accept=".csv" required className="text-sm" />
            <button type="submit" className="rounded-md bg-[#0f4c75] px-3 py-2 hover:bg-[#3282b8]">
              Subir y encolar
            </button>
          </form>
        )}
        <div className="mt-4 flex gap-4 text-sm">
          <a href="/dashboard/credenciales" className="text-[#3282b8]">
            Gestionar credenciales
          </a>
          <a href="/ejemplo-boletas.csv" download className="text-[#3282b8]">
            Descargar CSV de ejemplo
          </a>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-medium">Emisiones</h2>
        {batches.length === 0 ? (
          <p className="text-sm">Aún no has subido ningún CSV.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {batches.map((b) => (
              <li key={b.id} className="rounded-md border border-[#1f3460] bg-[#16213e] p-3">
                <a href={`/dashboard/batches/${b.id}`} className="flex items-center justify-between">
                  <span>{b.csvFilename}</span>
                  <span style={{ color: ESTADO_COLOR[b.status] }}>{ESTADO_LABEL[b.status]}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
