import { auth, signOut } from "@/auth";
import { DashboardNav } from "@/components/DashboardNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const inicial = email.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 z-50 flex h-auto w-full shrink-0 flex-col border-b border-border bg-surface-deep/50 backdrop-blur-sm md:h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-orange-700 text-sm font-semibold tracking-tighter text-white shadow-lg shadow-orange-900/20">
            SII
          </div>
          <span className="text-lg font-medium tracking-tight text-text">E-Boleta</span>
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

      <main className="h-screen flex-1 overflow-y-auto scroll-smooth">{children}</main>
    </div>
  );
}
