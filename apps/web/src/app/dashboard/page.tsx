import { redirect } from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { validarRut } from "@/lib/rut";
import { signOut } from "@/auth";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EmisionesExplorer } from "@/components/EmisionesExplorer";

interface FilaCsv {
  RutContribuyente: string;
  NombreCliente: string;
  RutCliente1: string;
  Nombre: string;
  Monto: string;
  TipoBoleta: string;
  MetodoPago: string;
  Receptor: string;
  RutReceptor?: string;
  NombreReceptor?: string;
  DireccionReceptor?: string;
  EmailReceptor?: string;
  TelefonoReceptor?: string;
  ConDetalle: string;
  Detalle?: string;
  Mail?: string;
}

const MAX_FILAS_CSV = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_RE = /^[\d+\s()-]+$/;
const TIPOS_BOLETA = ["exenta", "afecta"] as const;
const METODOS_PAGO = ["debito", "credito", "efectivo", "otro"] as const;

function esSiNo(valor: string | undefined): boolean | null {
  const v = (valor ?? "").trim().toUpperCase();
  if (v === "SI") return true;
  if (v === "NO") return false;
  return null;
}

function validarFilas(filas: FilaCsv[], emisorRutEsperado: string): string | null {
  if (filas.length === 0) return "el archivo no tiene filas";
  if (filas.length > MAX_FILAS_CSV) return `máximo ${MAX_FILAS_CSV} filas por archivo (tiene ${filas.length})`;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numFila = i + 2; // +1 por header, +1 por índice 1-based

    if (!fila.RutContribuyente || !validarRut(fila.RutContribuyente)) {
      return `fila ${numFila}: RutContribuyente inválido`;
    }
    if (fila.RutContribuyente.trim() !== emisorRutEsperado.trim()) {
      return `fila ${numFila}: RutContribuyente (${fila.RutContribuyente}) no coincide con el RUT del emisor seleccionado (${emisorRutEsperado})`;
    }

    if (!fila.NombreCliente || fila.NombreCliente.trim().length < 4) {
      return `fila ${numFila}: NombreCliente debe tener al menos 4 caracteres`;
    }
    if (!fila.RutCliente1 || !validarRut(fila.RutCliente1)) {
      return `fila ${numFila}: RutCliente1 inválido`;
    }

    if (!fila.Nombre?.trim()) return `fila ${numFila}: falta el Nombre`;
    if (fila.Nombre.trim().length > 200) return `fila ${numFila}: Nombre muy largo`;

    const monto = Number(fila.Monto);
    if (!fila.Monto || Number.isNaN(monto)) return `fila ${numFila}: Monto inválido`;
    if (!Number.isInteger(monto) || monto <= 0) return `fila ${numFila}: Monto debe ser un entero mayor a 0`;

    const tipoBoleta = fila.TipoBoleta?.trim().toLowerCase();
    if (!TIPOS_BOLETA.includes(tipoBoleta as (typeof TIPOS_BOLETA)[number])) {
      return `fila ${numFila}: TipoBoleta debe ser "exenta" o "afecta"`;
    }

    const metodoPago = fila.MetodoPago?.trim().toLowerCase();
    if (!METODOS_PAGO.includes(metodoPago as (typeof METODOS_PAGO)[number])) {
      return `fila ${numFila}: MetodoPago debe ser debito, credito, efectivo u otro`;
    }

    const conReceptor = esSiNo(fila.Receptor);
    if (conReceptor === null) return `fila ${numFila}: Receptor debe ser SI o NO`;
    if (conReceptor) {
      if (!fila.RutReceptor || !validarRut(fila.RutReceptor)) return `fila ${numFila}: RutReceptor inválido`;
      if (!fila.NombreReceptor || fila.NombreReceptor.trim().length < 4)
        return `fila ${numFila}: NombreReceptor debe tener al menos 4 caracteres`;
      if (!fila.DireccionReceptor || fila.DireccionReceptor.trim().length < 5)
        return `fila ${numFila}: DireccionReceptor debe tener al menos 5 caracteres`;
      if (!fila.EmailReceptor || !EMAIL_RE.test(fila.EmailReceptor.trim()))
        return `fila ${numFila}: EmailReceptor con formato inválido`;
      if (!fila.TelefonoReceptor || !TELEFONO_RE.test(fila.TelefonoReceptor.trim()))
        return `fila ${numFila}: TelefonoReceptor solo debe contener números`;
    }

    const conDetalle = esSiNo(fila.ConDetalle);
    if (conDetalle === null) return `fila ${numFila}: ConDetalle debe ser SI o NO`;
    if (conDetalle && !fila.Detalle?.trim()) return `fila ${numFila}: Detalle es obligatorio cuando ConDetalle es SI`;

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

  const batchId = await withUser(userId, async (tx) => {
    const [credencial] = await tx
      .select()
      .from(schema.siiCredentials)
      .where(and(eq(schema.siiCredentials.id, siiCredentialId), eq(schema.siiCredentials.userId, userId)));

    if (!credencial) {
      throw new Error("Credencial no encontrada");
    }

    const errorValidacion = validarFilas(filas, credencial.emisorRut ?? "");
    if (errorValidacion) {
      redirect("/dashboard?error=" + encodeURIComponent(errorValidacion));
    }

    const [batch] = await tx
      .insert(schema.batches)
      .values({ userId, siiCredentialId, csvFilename: archivo.name, status: "borrador" })
      .returning();

    await tx.insert(schema.boletas).values(
      filas.map((f) => {
        const conReceptor = esSiNo(f.Receptor) ?? false;
        const conDetalle = esSiNo(f.ConDetalle) ?? false;
        return {
          batchId: batch.id,
          rutContribuyente: f.RutContribuyente.trim(),
          nombreCliente: f.NombreCliente.trim(),
          rutCliente1: f.RutCliente1.trim(),
          nombre: f.Nombre.trim(),
          monto: Math.round(Number(f.Monto)),
          tipoBoleta: f.TipoBoleta.trim().toLowerCase() as (typeof TIPOS_BOLETA)[number],
          metodoPago: f.MetodoPago.trim().toLowerCase() as (typeof METODOS_PAGO)[number],
          conReceptor,
          receptorRut: conReceptor ? f.RutReceptor?.trim() : null,
          receptorNombre: conReceptor ? f.NombreReceptor?.trim() : null,
          receptorDireccion: conReceptor ? f.DireccionReceptor?.trim() : null,
          receptorEmail: conReceptor ? f.EmailReceptor?.trim() : null,
          receptorTelefono: conReceptor ? f.TelefonoReceptor?.trim() : null,
          conDetalle,
          detalle: conDetalle ? f.Detalle?.trim() : null,
          email: f.Mail?.trim() || null,
        };
      }),
    );

    return batch.id;
  });

  redirect(`/dashboard/batches/${batchId}`);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await requireUserId();

  const { credenciales, filas, boletasPorBatch } = await withUser(userId, async (tx) => {
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

    const filas = await tx
      .select({
        batchId: schema.batches.id,
        csvFilename: schema.batches.csvFilename,
        batchStatus: schema.batches.status,
        createdAt: schema.batches.createdAt,
        emisorRut: schema.siiCredentials.emisorRut,
        emisorRazonSocial: schema.siiCredentials.emisorRazonSocial,
      })
      .from(schema.batches)
      .innerJoin(schema.siiCredentials, eq(schema.batches.siiCredentialId, schema.siiCredentials.id))
      .where(eq(schema.batches.userId, userId))
      .orderBy(desc(schema.batches.createdAt));

    const boletasTodas = filas.length
      ? await tx.select().from(schema.boletas).where(inArray(schema.boletas.batchId, filas.map((f) => f.batchId)))
      : [];

    const boletasPorBatch = new Map<string, typeof boletasTodas>();
    for (const b of boletasTodas) {
      const arr = boletasPorBatch.get(b.batchId) ?? [];
      arr.push(b);
      boletasPorBatch.set(b.batchId, arr);
    }

    return { credenciales, filas, boletasPorBatch };
  });

  const archivos = filas.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    boletas: boletasPorBatch.get(f.batchId) ?? [],
  }));

  const hayTrabajoEnProceso = archivos.some((b) => b.batchStatus === "pending" || b.batchStatus === "running");

  return (
    <main className="mx-auto mt-12 max-w-2xl px-6 pb-16">
      <AutoRefresh activo={hayTrabajoEnProceso} />
      <div className="mb-8 flex items-center justify-between border-b border-border pb-5">
        <h1 className="text-page">SII E-Boleta</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="rounded text-sm text-muted transition-colors hover:text-text">
            Cerrar sesión
          </button>
        </form>
      </div>

      {error === "faltan_datos" && (
        <p className="mb-4 text-sm text-danger">Selecciona una credencial y un archivo CSV</p>
      )}
      {error && error !== "faltan_datos" && (
        <p className="mb-4 text-sm text-danger">CSV inválido: {error}</p>
      )}

      <section className="mb-10 rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-section">Nueva emisión por CSV</h2>
        {credenciales.length === 0 ? (
          <p className="text-sm text-muted">
            Primero agrega una{" "}
            <a href="/dashboard/credenciales" className="font-medium text-accent transition-colors hover:text-accent-hover">
              credencial SII
            </a>
            .
          </p>
        ) : (
          <form action={subirCsv} className="flex flex-col gap-4">
            <select
              name="siiCredentialId"
              required
              className="rounded-md border border-border bg-sunken px-3 py-2 transition-colors hover:border-border-strong focus:border-border-strong"
            >
              {credenciales.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emisor} ({c.rut})
                </option>
              ))}
            </select>
            <input
              name="csv"
              type="file"
              accept=".csv"
              required
              className="text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:bg-border"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 font-medium transition-colors hover:bg-primary-hover"
            >
              Subir y encolar
            </button>
          </form>
        )}
        <div className="mt-5 flex gap-4 border-t border-border pt-4 text-sm">
          <a href="/dashboard/credenciales" className="font-medium text-accent transition-colors hover:text-accent-hover">
            Gestionar credenciales
          </a>
          <a href="/ejemplo-boletas.csv" download className="font-medium text-accent transition-colors hover:text-accent-hover">
            Descargar CSV de ejemplo
          </a>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-section">Emisiones</h2>
        {archivos.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted">
            Aún no has subido ningún CSV.
          </p>
        ) : (
          <EmisionesExplorer archivos={archivos} />
        )}
      </section>
    </main>
  );
}
