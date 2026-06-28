import { auth, signOut } from "@/auth";
import { DashboardNav } from "@/components/DashboardNav";
import { BrandMark } from "@/components/BrandMark";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const inicial = email.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 z-50 flex h-auto w-full shrink-0 flex-col border-b border-border bg-surface-deep/50 backdrop-blur-sm md:h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 p-6">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/35 bg-gradient-to-br from-accent/25 to-primary/15 text-xs font-bold text-accent"
          >
            Q
          </span>
          <div className="flex flex-col items-start gap-1.5 leading-tight">
            <span className="text-lg font-medium tracking-tight text-text">E-Boleta</span>
            <span className="brand-pill px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
              <span className="brand-pill__dot" aria-hidden="true" />
              by QAR
            </span>
          </div>
        </div>

        <DashboardNav />

        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-xs text-text">
                {inicial}
              </div>
              <div className="flex min-w-0 flex-col text-left">
                <span className="truncate text-xs font-medium text-text" title={email}>
                  {email || "Sesión activa"}
                </span>
                <span className="text-[10px] text-faint">Cuenta SII</span>
              </div>
            </div>
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
      </aside>

      <main className="flex h-screen flex-1 flex-col overflow-y-auto scroll-smooth">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border px-4 py-4 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <BrandMark size="sm" />
            <p className="text-[11px] text-faint">© 2026 QAR Studio · Desarrollo web &amp; soluciones digitales</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
