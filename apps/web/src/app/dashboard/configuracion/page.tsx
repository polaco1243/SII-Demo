import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { db, schema } from "@sii-demo/db";
import { requireUserId } from "@/lib/session";

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

async function cambiarClave(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const claveActual = String(formData.get("claveActual") ?? "");
  const claveNueva = String(formData.get("claveNueva") ?? "");

  if (claveNueva.length < 8) {
    redirect("/dashboard/configuracion?error=clave_corta");
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
      <h1 className="mb-6 border-b border-border pb-5 text-page">Configuración</h1>

      {ok === "1" && (
        <p className="mb-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Nombre actualizado correctamente
        </p>
      )}
      {ok === "clave" && (
        <p className="mb-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Contraseña actualizada correctamente
        </p>
      )}
      {error === "clave_corta" && (
        <p className="mb-4 text-sm text-danger">La nueva contraseña debe tener al menos 8 caracteres</p>
      )}
      {error === "clave_incorrecta" && (
        <p className="mb-4 text-sm text-danger">La contraseña actual no es correcta</p>
      )}

      <section className="glass-card rounded-2xl p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
        <h2 className="mb-4 text-section">Perfil</h2>
        <form action={actualizarNombre} className="flex flex-col gap-4">
          <div>
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
          <p className="text-sm text-muted">Correo de la cuenta: {usuario?.email}</p>
          <button type="submit" className="btn-primary self-start rounded-md px-4 py-2 text-sm">
            Guardar
          </button>
        </form>
      </section>

      <section className="glass-card mt-4 rounded-2xl p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
        <h2 className="mb-4 text-section">Contraseña</h2>
        <form action={cambiarClave} className="flex flex-col gap-4">
          <input
            type="password"
            name="claveActual"
            placeholder="Contraseña actual"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm transition-colors hover:border-border-strong focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
          />
          <input
            type="password"
            name="claveNueva"
            placeholder="Nueva contraseña (mínimo 8 caracteres)"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm transition-colors hover:border-border-strong focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
          />
          <button type="submit" className="btn-primary self-start rounded-md px-4 py-2 text-sm">
            Cambiar contraseña
          </button>
        </form>
      </section>
    </div>
  );
}
