import { eq } from "drizzle-orm";
import { db, schema } from "@sii-demo/db";
import { auth, signOut } from "@/auth";
import { DashboardNav } from "@/components/DashboardNav";
import { BrandMark } from "@/components/BrandMark";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const userId = session?.user?.id;

  const [usuario] = userId ? await db.select().from(schema.users).where(eq(schema.users.id, userId)) : [];
  const nombreMostrado = usuario?.nombre || email;
  const inicial = nombreMostrado.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 z-50 flex h-auto w-full shrink-0 flex-col border-b border-border bg-surface-deep/50 backdrop-blur-sm md:h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 p-6">
          <BrandMark size="sm" showLabel={false} />
          <span className="font-head text-lg tracking-tight text-text" style={{ fontWeight: 700, letterSpacing: "0.02em" }}>
            E-Boleta
          </span>
        </div>

        <DashboardNav />

        <div className="border-t border-border bg-bg p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-xs text-text">
                {inicial}
              </div>
              <div className="flex min-w-0 flex-col text-left">
                <span className="truncate text-xs font-medium text-text" title={email}>
                  {nombreMostrado || "Sesión activa"}
                </span>
                <span className="text-[10px] text-faint">Cuenta SII</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href="/dashboard/configuracion"
                title="Configuración"
                className="rounded p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-text"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </a>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  title="Cerrar sesión"
                  className="rounded p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-text"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex h-screen flex-1 flex-col overflow-y-auto scroll-smooth">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border px-4 py-4 md:px-8" style={{ background: "#050505" }}>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <BrandMark size="sm" />
            <p className="text-[11px] text-faint">© 2026 QAR Studio · Desarrollo web &amp; soluciones digitales</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
