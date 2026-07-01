import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { validarRut } from "@/lib/rut";
import { auth } from "@/auth";
import { registrarEvento } from "@/lib/auditoria";
import { FileChipInput } from "@/components/FileChipInput";

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
const METODOS_PAGO = ["debito", "credito", "efectivo", "otro", "transferencia"] as const;

function esSiNo(valor: string | undefined): boolean | null {
  // Normalizar: quitar tildes para aceptar "Sí"/"sí" → "SI" y "Nó" → "NO"
  const v = (valor ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
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
      return `fila ${numFila}: MetodoPago debe ser debito, credito, efectivo, transferencia u otro`;
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
  const session = await auth();
  const actorEmail = session?.user?.email ?? "";
  const siiCredentialId = String(formData.get("siiCredentialId") ?? "");
  const archivo = formData.get("csv") as File | null;

  if (!siiCredentialId || !archivo || archivo.size === 0) {
    redirect("/dashboard/emisiones/nueva?error=faltan_datos");
  }

  const texto = await archivo.text();
  let filas: FilaCsv[];
  try {
    filas = parse(texto, { columns: true, delimiter: ";", trim: true, skip_empty_lines: true });
  } catch {
    redirect("/dashboard/emisiones/nueva?error=" + encodeURIComponent("el archivo no se pudo leer como CSV"));
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
      redirect("/dashboard/emisiones/nueva?error=" + encodeURIComponent(errorValidacion));
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

    await registrarEvento(tx, {
      userId,
      actorEmail,
      tipo: "csv_subido",
      entidadId: batch.id,
      razonSocialSnapshot: credencial.emisorRazonSocial,
      rutSnapshot: credencial.emisorRut,
      descripcion: `Subió "${archivo.name}" (${filas.length} fila${filas.length === 1 ? "" : "s"}) para ${credencial.emisorRazonSocial ?? credencial.rut}`,
      detalle: { csvFilename: archivo.name, filas: filas.length },
    });

    return batch.id;
  });

  redirect(`/dashboard/batches/${batchId}`);
}

export default async function NuevaEmisionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await requireUserId();

  const credenciales = await withUser(userId, (tx) =>
    tx
      .select()
      .from(schema.siiCredentials)
      .where(
        and(
          eq(schema.siiCredentials.userId, userId),
          eq(schema.siiCredentials.status, "lista"),
          eq(schema.siiCredentials.activa, true),
        ),
      ),
  );

  return (
    <div className="fade-in mx-auto max-w-3xl p-4 md:p-8">
      <a href="/dashboard/emisiones" className="inline-block rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
        ← Volver a Emisiones
      </a>

      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="text-page">Nueva emisión por CSV</h1>
        <div className="flex gap-2">
          <a
            href="/ejemplo-boletas.csv"
            download
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-[#d4d4d8] transition-colors hover:bg-white/[0.1] hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Descargar CSV de ejemplo
          </a>
        </div>
      </div>

      {error === "faltan_datos" && (
        <p className="mb-4 text-sm text-danger">Selecciona una credencial y un archivo CSV</p>
      )}
      {error && error !== "faltan_datos" && (
        <p className="mb-4 text-sm text-danger">CSV inválido: {error}</p>
      )}

      <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/70 to-black p-5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
        <h2 className="mb-3 text-section">Datos del archivo</h2>
        {credenciales.length === 0 ? (
          <p className="text-sm text-muted">
            Primero agrega una{" "}
            <a href="/dashboard/credenciales" className="font-medium text-accent transition-colors hover:text-accent-hover">
              credencial SII
            </a>
            .
          </p>
        ) : (
          <form action={subirCsv} className="flex flex-col gap-3">
            <select
              name="siiCredentialId"
              required
              className="truncate rounded-md border border-border bg-sunken px-3 py-2 text-sm transition-colors hover:border-border-strong focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
            >
              {credenciales.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emisor} ({c.rut})
                </option>
              ))}
            </select>
            <FileChipInput />
            <button
              type="submit"
              className="btn-primary self-start rounded-md px-3 py-2"
            >
              Subir y encolar
            </button>
          </form>
        )}
      </section>

      <aside className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
        <h2 className="mb-3 text-section">Tu CSV debe cumplir</h2>
        <ul className="flex flex-col gap-2.5 text-sm text-muted">
          {[
            "RutContribuyente debe coincidir con el emisor seleccionado",
            "Receptor y ConDetalle van con SI o NO",
            "Si Receptor=SI: RutReceptor, NombreReceptor, DireccionReceptor, EmailReceptor y TelefonoReceptor son obligatorios. Si Receptor=NO, esos campos se ignoran.",
            "Si ConDetalle=SI: Detalle es obligatorio",
            "Máximo 200 filas por archivo",
          ].map((texto) => (
            <li key={texto} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 text-success" aria-hidden="true">
                  <path d="M4 10.5 8 14.5 16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
