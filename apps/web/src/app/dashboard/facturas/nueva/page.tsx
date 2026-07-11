import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { validarRut, splitRut } from "@/lib/rut";
import { auth } from "@/auth";
import { registrarEvento } from "@/lib/auditoria";
import { FileChipInput } from "@/components/FileChipInput";
import { SubmitButton } from "@/components/SubmitButton";

interface FilaCsv {
  RutContribuyente: string;
  FacturaRef: string;
  ReceptorRut: string;
  ReceptorRazonSocial: string;
  TipoCompra?: string;
  ReceptorDireccion: string;
  ReceptorComuna: string;
  ReceptorCiudad?: string;
  ReceptorGiro: string;
  ReceptorContacto?: string;
  RutSolicita?: string;
  RutTransporte?: string;
  Patente?: string;
  RutChofer?: string;
  NombreChofer?: string;
  FormaPago: string;
  PctDescuentoGlobal?: string;
  NombreProducto: string;
  Cantidad: string;
  Unidad?: string;
  Precio: string;
  PctDescuentoItem?: string;
}

const MAX_FILAS_CSV = 500;
const TIPOS_COMPRA = [
  "del_giro",
  "supermercados",
  "bienes_raices",
  "activo_fijo",
  "iva_uso_comun",
  "iva_no_recuperable",
  "no_corresponde",
] as const;
const FORMAS_PAGO = ["contado", "credito", "sin_costo"] as const;

function validarFilas(filas: FilaCsv[], emisorRutEsperado: string): string | null {
  if (filas.length === 0) return "el archivo no tiene filas";
  if (filas.length > MAX_FILAS_CSV) return `máximo ${MAX_FILAS_CSV} filas por archivo (tiene ${filas.length})`;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numFila = i + 2;

    if (!fila.RutContribuyente || !validarRut(fila.RutContribuyente)) {
      return `fila ${numFila}: RutContribuyente inválido`;
    }
    if (fila.RutContribuyente.trim() !== emisorRutEsperado.trim()) {
      return `fila ${numFila}: RutContribuyente (${fila.RutContribuyente}) no coincide con el RUT del emisor seleccionado (${emisorRutEsperado})`;
    }

    if (!fila.FacturaRef?.trim()) return `fila ${numFila}: FacturaRef es obligatorio (agrupa las líneas de una misma factura)`;

    if (!fila.ReceptorRut || !validarRut(fila.ReceptorRut)) return `fila ${numFila}: ReceptorRut inválido`;
    if (!fila.ReceptorRazonSocial || fila.ReceptorRazonSocial.trim().length < 2)
      return `fila ${numFila}: ReceptorRazonSocial es obligatorio`;

    const tipoCompra = (fila.TipoCompra?.trim().toLowerCase() || "del_giro") as (typeof TIPOS_COMPRA)[number];
    if (!TIPOS_COMPRA.includes(tipoCompra)) {
      return `fila ${numFila}: TipoCompra debe ser una de: ${TIPOS_COMPRA.join(", ")}`;
    }

    if (!fila.ReceptorDireccion?.trim()) return `fila ${numFila}: ReceptorDireccion es obligatoria`;
    if (!fila.ReceptorComuna?.trim()) return `fila ${numFila}: ReceptorComuna es obligatoria`;
    if (!fila.ReceptorGiro?.trim()) return `fila ${numFila}: ReceptorGiro es obligatorio`;

    const formaPago = fila.FormaPago?.trim().toLowerCase();
    if (!FORMAS_PAGO.includes(formaPago as (typeof FORMAS_PAGO)[number])) {
      return `fila ${numFila}: FormaPago debe ser contado, credito o sin_costo`;
    }

    if (!fila.NombreProducto?.trim()) return `fila ${numFila}: NombreProducto es obligatorio`;

    const cantidad = Number(fila.Cantidad);
    if (!fila.Cantidad || Number.isNaN(cantidad) || cantidad <= 0) return `fila ${numFila}: Cantidad debe ser un número mayor a 0`;

    const precio = Number(fila.Precio);
    if (!fila.Precio || Number.isNaN(precio) || precio < 0) return `fila ${numFila}: Precio debe ser un número mayor o igual a 0`;
  }

  return null;
}

interface FacturaAgrupada {
  facturaRef: string;
  cabecera: FilaCsv;
  filas: FilaCsv[];
}

function agruparPorFactura(filas: FilaCsv[]): FacturaAgrupada[] {
  const grupos = new Map<string, FilaCsv[]>();
  for (const fila of filas) {
    const ref = fila.FacturaRef.trim();
    const arr = grupos.get(ref) ?? [];
    arr.push(fila);
    grupos.set(ref, arr);
  }
  return Array.from(grupos.entries()).map(([facturaRef, filasGrupo]) => ({
    facturaRef,
    cabecera: filasGrupo[0],
    filas: filasGrupo,
  }));
}

async function subirCsv(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const session = await auth();
  const actorEmail = session?.user?.email ?? "";
  const siiCredentialId = String(formData.get("siiCredentialId") ?? "");
  const archivo = formData.get("csv") as File | null;

  if (!siiCredentialId || !archivo || archivo.size === 0) {
    redirect("/dashboard/facturas/nueva?error=faltan_datos");
  }

  const texto = await archivo.text();
  let filas: FilaCsv[];
  try {
    filas = parse(texto, { columns: true, delimiter: ";", trim: true, skip_empty_lines: true });
  } catch {
    redirect("/dashboard/facturas/nueva?error=" + encodeURIComponent("el archivo no se pudo leer como CSV"));
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
      redirect("/dashboard/facturas/nueva?error=" + encodeURIComponent(errorValidacion));
    }

    const grupos = agruparPorFactura(filas);

    const [batch] = await tx
      .insert(schema.batches)
      .values({
        userId,
        siiCredentialId,
        tipoDocumento: "factura",
        csvFilename: archivo.name,
        status: "borrador",
      })
      .returning();

    for (const grupo of grupos) {
      const c = grupo.cabecera;
      const receptor = splitRut(c.ReceptorRut);
      const rutSolicita = c.RutSolicita?.trim() ? splitRut(c.RutSolicita) : null;
      const rutTransporte = c.RutTransporte?.trim() ? splitRut(c.RutTransporte) : null;
      const rutChofer = c.RutChofer?.trim() ? splitRut(c.RutChofer) : null;

      const items = grupo.filas.map((f) => {
        const cantidad = Math.round(Number(f.Cantidad));
        const precio = Math.round(Number(f.Precio));
        const pctDescuento = Math.round(Number(f.PctDescuentoItem) || 0);
        const subtotal = Math.round(cantidad * precio * (1 - pctDescuento / 100));
        return {
          nombre: f.NombreProducto.trim(),
          cantidad,
          unidad: f.Unidad?.trim() || null,
          precio,
          pctDescuento,
          subtotal,
        };
      });

      const montoNeto = items.reduce((acc, i) => acc + i.subtotal, 0);
      const pctDescuentoGlobal = Math.round(Number(c.PctDescuentoGlobal) || 0);
      const montoDescuentoGlobal = Math.round(montoNeto * (pctDescuentoGlobal / 100));
      const montoTotal = montoNeto - montoDescuentoGlobal;

      const [factura] = await tx
        .insert(schema.facturas)
        .values({
          batchId: batch.id,
          facturaRef: grupo.facturaRef,
          rutContribuyente: c.RutContribuyente.trim(),
          receptorRut: receptor.rut,
          receptorDv: receptor.dv,
          receptorRazonSocial: c.ReceptorRazonSocial.trim(),
          receptorTipoCompra: (c.TipoCompra?.trim().toLowerCase() ||
            "del_giro") as (typeof TIPOS_COMPRA)[number],
          receptorDireccion: c.ReceptorDireccion.trim(),
          receptorComuna: c.ReceptorComuna.trim(),
          receptorCiudad: c.ReceptorCiudad?.trim() || null,
          receptorGiro: c.ReceptorGiro.trim(),
          receptorContacto: c.ReceptorContacto?.trim() || null,
          rutSolicita: rutSolicita?.rut ?? null,
          dvSolicita: rutSolicita?.dv ?? null,
          rutTransporte: rutTransporte?.rut ?? null,
          dvTransporte: rutTransporte?.dv ?? null,
          patente: c.Patente?.trim() || null,
          rutChofer: rutChofer?.rut ?? null,
          dvChofer: rutChofer?.dv ?? null,
          nombreChofer: c.NombreChofer?.trim() || null,
          formaPago: c.FormaPago.trim().toLowerCase() as (typeof FORMAS_PAGO)[number],
          pctDescuentoGlobal,
          montoDescuentoGlobal,
          montoNeto,
          montoTotal,
        })
        .returning();

      await tx.insert(schema.facturaItems).values(
        items.map((item, idx) => ({
          facturaId: factura.id,
          orden: idx,
          ...item,
        })),
      );
    }

    await registrarEvento(tx, {
      userId,
      actorEmail,
      tipo: "csv_subido",
      entidadId: batch.id,
      razonSocialSnapshot: credencial.emisorRazonSocial,
      rutSnapshot: credencial.emisorRut,
      descripcion: `Subió "${archivo.name}" (${grupos.length} factura${grupos.length === 1 ? "" : "s"}) para ${credencial.emisorRazonSocial ?? credencial.rut}`,
      detalle: { csvFilename: archivo.name, facturas: grupos.length },
    });

    return batch.id;
  });

  redirect(`/dashboard/facturas/${batchId}`);
}

export default async function NuevaFacturaPage({
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
      <a href="/dashboard/facturas" className="inline-block rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
        ← Volver a Facturas
      </a>

      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="text-page">Nueva factura por CSV</h1>
        <a
          href="/ejemplo-facturas.csv"
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
            <SubmitButton
              label="Subir y encolar"
              pendingLabel="Cargando..."
              className="btn-primary self-start rounded-md px-3 py-2"
            />
          </form>
        )}
      </section>

      <aside className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
        <h2 className="mb-4 text-section">Columnas del CSV</h2>
        <p className="mb-3 text-xs text-muted">
          Cada fila es una <span className="font-medium text-text">línea de producto/servicio</span>. Varias filas con el
          mismo <span className="font-mono text-text">FacturaRef</span> forman una sola factura con varias líneas.
        </p>

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Obligatorias (por fila)</p>
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-left text-faint">
                <th className="pb-1.5 pr-4 font-medium">Columna</th>
                <th className="pb-1.5 font-medium">Valores aceptados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-muted">
              {[
                ["RutContribuyente", "RUT del emisor seleccionado"],
                ["FacturaRef", "Identificador propio que agrupa las líneas de una factura (ej. F-001)"],
                ["ReceptorRut", "RUT válido del receptor"],
                ["ReceptorRazonSocial", "Razón social del receptor"],
                ["ReceptorDireccion", "Dirección del receptor"],
                ["ReceptorComuna", "Comuna del receptor"],
                ["ReceptorGiro", "Giro del receptor"],
                ["FormaPago", "contado  |  credito  |  sin_costo"],
                ["NombreProducto", "Nombre del producto o servicio de esta línea"],
                ["Cantidad", "Número mayor a 0"],
                ["Precio", "Precio unitario en CLP"],
              ].map(([col, val]) => (
                <tr key={col}>
                  <td className="py-1.5 pr-4 font-mono text-text">{col}</td>
                  <td className="py-1.5">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Opcionales</p>
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-white/[0.05] text-muted">
              {[
                ["TipoCompra", "del_giro (default) | supermercados | bienes_raices | activo_fijo | iva_uso_comun | iva_no_recuperable | no_corresponde"],
                ["ReceptorCiudad", "Ciudad del receptor"],
                ["ReceptorContacto", "Nombre de contacto"],
                ["RutSolicita", "RUT de quien solicita el documento"],
                ["RutTransporte", "RUT de la empresa de transporte"],
                ["Patente", "Patente del vehículo"],
                ["RutChofer", "RUT del chofer"],
                ["NombreChofer", "Nombre del chofer"],
                ["Unidad", "Unidad de medida (ej. UN, KG, HRS)"],
                ["PctDescuentoItem", "% de descuento de esta línea (0-100)"],
                ["PctDescuentoGlobal", "% de descuento sobre el total de la factura"],
              ].map(([col, val]) => (
                <tr key={col}>
                  <td className="py-1.5 pr-4 font-mono text-text">{col}</td>
                  <td className="py-1.5">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-faint">Separador: punto y coma (;) · Máximo 500 filas por archivo</p>
      </aside>
    </div>
  );
}
