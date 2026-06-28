import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw err;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="glass-panel fade-in mx-auto mt-24 max-w-sm rounded-card p-8 shadow-card">
      <h1 className="mb-6 text-page">Iniciar sesión</h1>
      {error && <p className="mb-4 text-sm text-danger">Correo o contraseña incorrectos</p>}
      <form action={login} className="flex flex-col gap-4">
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
          placeholder="Contraseña"
          required
          className="rounded-md border border-border bg-sunken px-3 py-2 transition-colors hover:border-border-strong focus:border-border-strong"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 font-medium transition-colors hover:bg-primary-hover"
        >
          Entrar
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <a href="/register" className="font-medium text-accent transition-colors hover:text-accent-hover">
          Regístrate
        </a>
      </p>
    </main>
  );
}
