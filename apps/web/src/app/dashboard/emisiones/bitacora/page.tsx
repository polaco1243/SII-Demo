import { eq, and, desc, gte, lte } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { EmisionesSubNav } from "@/components/EmisionesSubNav";

const TIPO_LABEL: Record<string, string> = {
  credencial_agregada: "Credencial agregada",
  credencial_confirmada: "Razón social confirmada",
  credencial_eliminada: "Razón social eliminada",
  credencial_clave_actualizada: "Clave SII actualizada",
  csv_subido: "CSV subido",
  batch_confirmado: "Emisión confirmada",
  batch_cancelado: "Emisión cancelada",
  boleta_reintentada: "Boleta reintentada",
  archivo_procesado: "Archivo procesado (sistema)",
};

const TIPO_BADGE: Record<string, string> = {
  credencial_agregada: "border-accent/40 bg-accent/10 text-accent",
  credencial_confirmada: "border-success/40 bg-success/15 text-success",
  credencial_eliminada: "border-danger/40 bg-danger/15 text-danger",
  credencial_clave_actualizada: "border-accent/40 bg-accent/10 text-accent",
  csv_subido: "border-accent/40 bg-accent/10 text-accent",
  batch_confirmado: "border-success/40 bg-success/15 text-success",
  batch_cancelado: "border-warning/40 bg-warning/15 text-warning",
  boleta_reintentada: "border-info/40 bg-info/15 text-accent",
  archivo_procesado: "border-border bg-surface-2 text-muted",
};

function fechaHora(d: Date): string {
  return d.toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ razonSocial?: string; tipo?: string; desde?: string; hasta?: string }>;
}) {
  const { razonSocial = "", tipo = "", desde = "", hasta = "" } = await searchParams;
  const userId = await requireUserId();

  const { eventos, razonesSociales } = await withUser(userId, async (tx) => {
    const condiciones = [eq(schema.auditEvents.userId, userId)];
    if (razonSocial) condiciones.push(eq(schema.auditEvents.razonSocialSnapshot, razonSocial));
    if (tipo) condiciones.push(eq(schema.auditEvents.tipo, tipo as (typeof schema.auditEventType.enumValues)[number]));
    if (desde) condiciones.push(gte(schema.auditEvents.createdAt, new Date(desde)));
    if (hasta) {
      const hastaFin = new Date(hasta);
      hastaFin.setHours(23, 59, 59, 999);
      condiciones.push(lte(schema.auditEvents.createdAt, hastaFin));
    }

    const eventos = await tx
      .select()
      .from(schema.auditEvents)
      .where(and(...condiciones))
      .orderBy(desc(schema.auditEvents.createdAt));

    const todos = await tx
      .select({ razonSocialSnapshot: schema.auditEvents.razonSocialSnapshot })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.userId, userId));
    const razonesSociales = Array.from(new Set(todos.map((t) => t.razonSocialSnapshot).filter((r): r is string => !!r))).sort();

    return { eventos, razonesSociales };
  });

  const queryExport = new URLSearchParams({ razonSocial, tipo, desde, hasta }).toString();

  return (
    <div className="fade-in mx-auto max-w-7xl p-4 md:p-8">
      <EmisionesSubNav />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-page">Bitácora de auditoría</h1>
          <p className="text-sm text-muted">Registro permanente de toda actividad de la cuenta en Emisiones. No editable.</p>
        </div>
        <a
          href={`/api/bitacora/export?${queryExport}`}
          className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-[#d4d4d8] transition-colors hover:bg-white/[0.1] hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          Exportar CSV
        </a>
      </div>

      <form className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          name="razonSocial"
          defaultValue={razonSocial}
          className="rounded-md border border-border bg-sunken px-2 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent/40"
        >
          <option value="">Todas las razones sociales</option>
          {razonesSociales.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          name="tipo"
          defaultValue={tipo}
          className="rounded-md border border-border bg-sunken px-2 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent/40"
        >
          <option value="">Todos los eventos</option>
          {Object.entries(TIPO_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="desde"
          defaultValue={desde}
          className="rounded-md border border-border bg-sunken px-2 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent/40"
        />
        <input
          type="date"
          name="hasta"
          defaultValue={hasta}
          className="rounded-md border border-border bg-sunken px-2 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent/40"
        />
        <button
          type="submit"
          className="col-span-2 rounded-md border border-border bg-white/[0.04] px-3 py-1.5 text-sm text-muted transition-colors hover:text-text sm:col-span-1"
        >
          Filtrar
        </button>
        <a
          href="/dashboard/emisiones/bitacora"
          className="col-span-2 flex items-center justify-center rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-text sm:col-span-1"
        >
          Limpiar filtros
        </a>
      </form>

      {eventos.length === 0 ? (
        <p className="rounded-card border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-sm text-muted">
          No hay eventos que coincidan con los filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {eventos.map((e) => (
            <li key={e.id} className="glass-panel flex flex-col gap-1.5 rounded-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm">{e.descripcion}</p>
                <p className="text-xs text-faint">
                  {e.actorEmail} — {fechaHora(e.createdAt)}
                  {e.razonSocialSnapshot ? ` — ${e.razonSocialSnapshot}` : ""}
                </p>
              </div>
              <span className={`shrink-0 self-start rounded-full border px-2.5 py-0.5 text-caption font-medium sm:self-center ${TIPO_BADGE[e.tipo]}`}>
                {TIPO_LABEL[e.tipo]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
