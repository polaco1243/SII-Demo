import Link from "next/link";
import { eq, desc, and, or, ilike, inArray } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { HistorialExplorer } from "@/components/HistorialExplorer";
import { EmisionesSubNav } from "@/components/EmisionesSubNav";
import { ExportCsvButton } from "@/components/ExportCsvButton";

type Vigencia = "todas" | "vigentes" | "inactivas";

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ vigencia?: string; q?: string }>;
}) {
  const { vigencia: vigenciaParam, q = "" } = await searchParams;
  const vigencia: Vigencia = vigenciaParam === "vigentes" || vigenciaParam === "inactivas" ? vigenciaParam : "todas";
  const userId = await requireUserId();

  const { filas, boletasPorBatch } = await withUser(userId, async (tx) => {
    const condiciones = [eq(schema.batches.userId, userId)];
    if (vigencia === "vigentes") condiciones.push(eq(schema.siiCredentials.activa, true));
    if (vigencia === "inactivas") condiciones.push(eq(schema.siiCredentials.activa, false));
    if (q.trim()) {
      const like = `%${q.trim()}%`;
      condiciones.push(
        or(
          ilike(schema.siiCredentials.emisorRazonSocial, like),
          ilike(schema.siiCredentials.emisorRut, like),
          ilike(schema.batches.csvFilename, like),
        )!,
      );
    }

    const filas = await tx
      .select({
        batchId: schema.batches.id,
        csvFilename: schema.batches.csvFilename,
        batchStatus: schema.batches.status,
        createdAt: schema.batches.createdAt,
        emisorRut: schema.siiCredentials.emisorRut,
        emisorRazonSocial: schema.siiCredentials.emisorRazonSocial,
        credencialActiva: schema.siiCredentials.activa,
        credencialActualizadaEn: schema.siiCredentials.updatedAt,
      })
      .from(schema.batches)
      .innerJoin(schema.siiCredentials, eq(schema.batches.siiCredentialId, schema.siiCredentials.id))
      .where(and(...condiciones))
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

    return { filas, boletasPorBatch };
  });

  const archivos = filas.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    credencialActualizadaEn: f.credencialActualizadaEn.toISOString(),
    boletas: boletasPorBatch.get(f.batchId) ?? [],
  }));

  const VIGENCIAS: { valor: Vigencia; label: string }[] = [
    { valor: "todas", label: "Todas" },
    { valor: "vigentes", label: "Solo vigentes" },
    { valor: "inactivas", label: "Solo inactivas" },
  ];

  const queryExport = new URLSearchParams({ vigencia, q }).toString();

  return (
    <div className="fade-in mx-auto max-w-7xl p-4 md:p-8">
      <EmisionesSubNav />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-page">Historial completo</h1>
          <p className="text-sm text-muted">Todas las emisiones, incluidas las de razones sociales que ya no están vigentes.</p>
        </div>
        <ExportCsvButton href={`/api/historial/export?${queryExport}`} />
      </div>

      <form className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          {VIGENCIAS.map((v) => (
            <Link
              key={v.valor}
              href={`/dashboard/emisiones/historial?${new URLSearchParams({ vigencia: v.valor, q }).toString()}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                vigencia === v.valor
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-white/[0.02] text-muted hover:text-text"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="hidden" name="vigencia" value={vigencia} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por RUT, razón social o archivo…"
            className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-border-strong sm:w-64"
          />
          <button type="submit" className="rounded-md border border-border bg-white/[0.04] px-3 py-1.5 text-sm text-muted transition-colors hover:text-text">
            Buscar
          </button>
        </div>
      </form>

      <HistorialExplorer archivos={archivos} />
    </div>
  );
}
