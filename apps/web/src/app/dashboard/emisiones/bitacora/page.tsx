import { eq, and, desc, gte, lte } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { TIPO_EVENTO_LABEL, TIPO_EVENTO_BADGE } from "@/lib/eventos";
import { EmisionesSubNav } from "@/components/EmisionesSubNav";
import { ExportCsvButton } from "@/components/ExportCsvButton";

function fechaHora(d: Date): string {
  return d.toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ razonSocial?: string; tipo?: string; desde?: string; hasta?: string }>;
}) {
  const { razonSocial = "", tipo = "", desde = "", hasta = "" } = await searchParams;
  const hayFiltrosActivos = Boolean(razonSocial || tipo || desde || hasta);
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
        <ExportCsvButton href={`/api/bitacora/export?${queryExport}`} />
      </div>

      <details open={hayFiltrosActivos} className="group mb-4 rounded-card border border-border bg-surface/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="text-accent transition-transform duration-200 group-open:rotate-90">▶</span>
            Filtros
            {hayFiltrosActivos && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-caption font-medium text-accent">Activos</span>
            )}
          </span>
        </summary>

        <form className="flex flex-col gap-3 border-t border-border p-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted">Razón social</label>
              <select
                name="razonSocial"
                defaultValue={razonSocial}
                className="w-full rounded-md border border-border bg-sunken px-2 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent/40"
              >
                <option value="">Todas</option>
                {razonesSociales.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Tipo de evento</label>
              <select
                name="tipo"
                defaultValue={tipo}
                className="w-full rounded-md border border-border bg-sunken px-2 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent/40"
              >
                <option value="">Todos</option>
                {Object.entries(TIPO_EVENTO_LABEL).map(([valor, label]) => (
                  <option key={valor} value={valor}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Desde</label>
              <input
                type="date"
                name="desde"
                defaultValue={desde}
                className="w-full rounded-md border border-border bg-sunken px-2 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Hasta</label>
              <input
                type="date"
                name="hasta"
                defaultValue={hasta}
                className="w-full rounded-md border border-border bg-sunken px-2 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-accent/40"
              />
            </div>
          </div>
          <div className="flex gap-2 border-t border-border pt-3">
            <button type="submit" className="btn-primary rounded-md px-4 py-2 text-sm">
              Filtrar
            </button>
            <a
              href="/dashboard/emisiones/bitacora"
              className="flex items-center rounded-md border border-border bg-white/[0.04] px-4 py-2 text-sm text-muted transition-colors hover:text-text"
            >
              Limpiar filtros
            </a>
          </div>
        </form>
      </details>

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
              <span className={`shrink-0 self-start rounded-full border px-2.5 py-0.5 text-caption font-medium sm:self-center ${TIPO_EVENTO_BADGE[e.tipo]}`}>
                {TIPO_EVENTO_LABEL[e.tipo]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
