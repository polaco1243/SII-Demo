import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { db, schema } from "@sii-demo/db";

async function register(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    redirect("/register?error=datos_invalidos");
  }

  const passwordHash = await hash(password, 12);

  try {
    await db.insert(schema.users).values({ email, passwordHash });
  } catch {
    redirect("/register?error=correo_en_uso");
  }

  redirect("/login");
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="glass-panel fade-in mx-auto mt-24 max-w-sm rounded-card p-8 shadow-card">
      <h1 className="mb-6 text-page">Crear cuenta</h1>
      {error === "correo_en_uso" && (
        <p className="mb-4 text-sm text-danger">Ese correo ya está registrado</p>
      )}
      {error === "datos_invalidos" && (
        <p className="mb-4 text-sm text-danger">Correo inválido o contraseña muy corta (mínimo 8)</p>
      )}
      <form action={register} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="correo@ejemplo.com"
          required
          className="rounded-md border border-border bg-sunken px-3 py-2 transition-colors hover:border-border-strong focus:border-border-strong"
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña (mínimo 8 caracteres)"
          minLength={8}
          required
          className="rounded-md border border-border bg-sunken px-3 py-2 transition-colors hover:border-border-strong focus:border-border-strong"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 font-medium transition-colors hover:bg-primary-hover"
        >
          Crear cuenta
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <a href="/login" className="font-medium text-accent transition-colors hover:text-accent-hover">
          Inicia sesión
        </a>
      </p>
    </main>
  );
}
