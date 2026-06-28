import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { db, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";
import { PasswordChangeFields } from "@/components/PasswordField";

async function actualizarNombre(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const nombre = String(formData.get("nombre") ?? "").trim();

  await db
    .update(schema.users)
    .set({ nombre: nombre || null })
    .where(eq(schema.users.id, userId));

  redirect("/dashboard/configuracion?ok=1");
}

function claveEsFuerte(clave: string): boolean {
  return (
    clave.length >= 12 &&
    /[A-Z]/.test(clave) &&
    /[a-z]/.test(clave) &&
    /[0-9]/.test(clave) &&
    /[^A-Za-z0-9]/.test(clave)
  );
}

async function cambiarClave(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const claveActual = String(formData.get("claveActual") ?? "");
  const claveNueva = String(formData.get("claveNueva") ?? "");

  if (!claveEsFuerte(claveNueva)) {
    redirect("/dashboard/configuracion?error=clave_debil");
  }

  const [usuario] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!usuario || !(await compare(claveActual, usuario.passwordHash))) {
    redirect("/dashboard/configuracion?error=clave_incorrecta");
  }

  const passwordHash = await hash(claveNueva, 12);
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId));

  redirect("/dashboard/configuracion?ok=clave");
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const userId = await requireUserId();

  const [usuario] = await db.select().from(schema.users).where(eq(schema.users.id, userId));

  return (
    <div className="fade-in mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-4 border-b border-border pb-4 text-page">Configuración</h1>

      {ok === "1" && (
        <p className="mb-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Nombre actualizado correctamente
        </p>
      )}
      {ok === "clave" && (
        <p className="mb-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Contraseña actualizada correctamente
        </p>
      )}
      {error === "clave_debil" && (
        <p className="mb-3 text-sm text-danger">La nueva contraseña no cumple con todos los requisitos</p>
      )}
      {error === "clave_incorrecta" && (
        <p className="mb-3 text-sm text-danger">La contraseña actual no es correcta</p>
      )}

      <section className="glass-card rounded-2xl p-5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
        <h2 className="mb-3 text-section">Perfil</h2>
        <form action={actualizarNombre} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="nombre" className="mb-1.5 block text-sm text-muted">
              Nombre para el saludo del dashboard
            </label>
            <input
              id="nombre"
              name="nombre"
              defaultValue={usuario?.nombre ?? ""}
              placeholder={usuario?.email?.split("@")[0] ?? "Tu nombre"}
              className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm transition-colors hover:border-border-strong focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <button type="submit" className="btn-primary rounded-md px-4 py-2 text-sm">
            Guardar
          </button>
        </form>
        <p className="mt-2 text-xs text-faint">Correo de la cuenta: {usuario?.email}</p>
      </section>

      <section className="glass-card mt-3 rounded-2xl p-5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
        <h2 className="mb-3 text-section">Contraseña</h2>
        <form action={cambiarClave} className="flex flex-col gap-3">
          <PasswordChangeFields />
          <button type="submit" className="btn-primary self-start rounded-md px-4 py-2 text-sm">
            Cambiar contraseña
          </button>
        </form>

        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M10 2.5 4 5v4.5c0 3.5 2.4 6.4 6 7.5 3.6-1.1 6-4 6-7.5V5l-6-2.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            ¿Por qué usamos Cifrado AES-256?
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Tu contraseña nunca se guarda en texto plano — se transforma con un hash irreversible (bcrypt).
            Las claves del SII que registras en Credenciales son distintas: esas sí necesitan recuperarse para
            automatizar la emisión, así que se cifran con AES-256-GCM, el mismo estándar que usan bancos y
            gobiernos. Ni con acceso directo a la base de datos se puede leer tu clave del SII sin la llave de
            cifrado del servidor.
          </p>
        </div>
      </section>
    </div>
  );
}
