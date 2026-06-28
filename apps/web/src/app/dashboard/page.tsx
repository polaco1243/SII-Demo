import type { CSSProperties } from "react";
import { eq, inArray } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { auth } from "@/auth";
import { AutoRefresh } from "@/components/AutoRefresh";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const session = await auth();
  const email = session?.user?.email ?? "";

  const { credenciales, batches, boletasPorBatch } = await withUser(userId, async (tx) => {
    const credenciales = await tx
      .select()
      .from(schema.siiCredentials)
      .where(eq(schema.siiCredentials.userId, userId));

    const batches = await tx
      .select()
      .from(schema.batches)
      .where(eq(schema.batches.userId, userId));

    const boletasTodas = batches.length
      ? await tx.select().from(schema.boletas).where(inArray(schema.boletas.batchId, batches.map((b) => b.id)))
      : [];

    const boletasPorBatch = new Map<string, typeof boletasTodas>();
    for (const b of boletasTodas) {
      const arr = boletasPorBatch.get(b.batchId) ?? [];
      arr.push(b);
      boletasPorBatch.set(b.batchId, arr);
    }

    return { credenciales, batches, boletasPorBatch };
  });

  const todasLasBoletas = batches.flatMap((b) => boletasPorBatch.get(b.id) ?? []);
  const hayTrabajoEnProceso = batches.some((b) => b.status === "pending" || b.status === "running");

  // KPIs reales derivados de los datos ya consultados
  const credencialesActivas = credenciales.filter((c) => c.status === "lista" && c.activa).length;
  const boletasEmitidas = todasLasBoletas.filter((b) => b.status === "success").length;
  const boletasConError = todasLasBoletas.filter((b) => b.status === "failed").length;
  const boletasPendientes = todasLasBoletas.filter((b) => b.status === "pending").length;
  const batchesPorConfirmar = batches.filter((b) => b.status === "borrador").length;
  const batchesEnProceso = batches.filter((b) => b.status === "pending" || b.status === "running").length;
  const montoEmitido = todasLasBoletas
    .filter((b) => b.status === "success")
    .reduce((acc, b) => acc + b.monto, 0);
  const totalBoletas = todasLasBoletas.length;
  const tasaExito = totalBoletas > 0 ? Math.round((boletasEmitidas / totalBoletas) * 100) : 0;
  const saludo = email ? email.split("@")[0] : "de nuevo";

  // Proporciones reales para el mini gráfico de barras (success / failed / pending).
  // La altura de cada barra se normaliza contra el máximo, con un piso para que
  // una categoría no nula nunca quede invisible.
  const maxBoletas = Math.max(boletasEmitidas, boletasConError, boletasPendientes, 1);
  const alturaBarra = (valor: number): CSSProperties =>
    ({ "--bar-h": valor === 0 ? "4px" : `${Math.max(12, Math.round((valor / maxBoletas) * 40))}px` }) as CSSProperties;

  return (
    <div className="fade-in mx-auto max-w-7xl p-4 md:p-8">
      <AutoRefresh activo={hayTrabajoEnProceso} />

      {/* Banner de bienvenida */}
      <section className="relative mb-6 overflow-hidden rounded-xl border border-border bg-gradient-to-b from-surface-deep to-bg p-6 md:p-8">
        <div className="pointer-events-none absolute right-0 top-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative z-10 mb-8">
          <h1 className="mb-2 text-xl font-medium tracking-tight text-text md:text-2xl">
            Bienvenido, {saludo}
          </h1>
          <p className="max-w-xl text-sm text-muted">
            Resumen de tus emisiones de boletas electrónicas SII.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-white/[0.02] p-4">
            <h3 className="mb-1 text-xs text-faint">Credenciales activas</h3>
            <div className="text-xl font-medium text-text">{credencialesActivas}</div>
          </div>
          <div className="rounded-lg border border-border bg-white/[0.02] p-4">
            <h3 className="mb-1 text-xs text-faint">Boletas emitidas</h3>
            <div className="text-xl font-medium text-text">{boletasEmitidas.toLocaleString("es-CL")}</div>
          </div>
          <div className="rounded-lg border border-border bg-white/[0.02] p-4">
            <h3 className="mb-1 text-xs text-faint">Emisiones totales</h3>
            <div className="text-xl font-medium text-text">{batches.length}</div>
          </div>
          <div className="rounded-lg border border-border bg-white/[0.02] p-4">
            <h3 className="mb-1 text-xs text-faint">Por confirmar</h3>
            <div className="text-xl font-medium text-text">{batchesPorConfirmar}</div>
          </div>
        </div>
      </section>

      {/* KPI cards grandes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="glass-panel gradient-border bento-card rounded-lg p-5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <p className="text-xs font-medium text-faint">Monto emitido</p>
            {tasaExito > 0 && (
              <span className="inline-flex items-center rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">
                {tasaExito}% éxito
              </span>
            )}
          </div>
          <div className="text-2xl font-medium tracking-tight text-text">
            ${montoEmitido.toLocaleString("es-CL")}
          </div>
          {totalBoletas > 0 && (
            <div
              className="bar-chart mt-4"
              role="img"
              aria-label={`Distribución de boletas: ${boletasEmitidas} emitidas, ${boletasConError} con error, ${boletasPendientes} pendientes`}
            >
              <span className="bar-chart__bar bg-success/70" style={alturaBarra(boletasEmitidas)} />
              <span className="bar-chart__bar bg-danger/70" style={alturaBarra(boletasConError)} />
              <span className="bar-chart__bar bg-accent/70" style={alturaBarra(boletasPendientes)} />
            </div>
          )}
        </div>
        <div className="glass-panel gradient-border bento-card rounded-lg p-5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <p className="text-xs font-medium text-faint">Boletas emitidas</p>
            <span className="inline-flex items-center rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">
              OK
            </span>
          </div>
          <div className="text-2xl font-medium tracking-tight text-text">
            {boletasEmitidas.toLocaleString("es-CL")}
          </div>
        </div>
        <div className="glass-panel gradient-border bento-card rounded-lg p-5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <p className="text-xs font-medium text-faint">Con error</p>
            {boletasConError > 0 && (
              <span className="inline-flex items-center rounded bg-danger/10 px-1.5 py-0.5 text-xs text-danger">
                revisar
              </span>
            )}
          </div>
          <div className="text-2xl font-medium tracking-tight text-text">
            {boletasConError.toLocaleString("es-CL")}
          </div>
        </div>
        <div className="glass-panel gradient-border bento-card rounded-lg p-5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <p className="text-xs font-medium text-faint">Pendientes / en proceso</p>
            {batchesEnProceso > 0 && (
              <span className="inline-flex items-center rounded bg-info/10 px-1.5 py-0.5 text-xs text-accent">
                activo
              </span>
            )}
          </div>
          <div className="text-2xl font-medium tracking-tight text-text">
            {(boletasPendientes + batchesEnProceso).toLocaleString("es-CL")}
          </div>
        </div>
      </div>
    </div>
  );
}
