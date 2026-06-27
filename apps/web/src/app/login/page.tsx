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
    <main className="mx-auto mt-24 max-w-sm rounded-lg border border-[#1f3460] bg-[#16213e] p-8">
      <h1 className="mb-6 text-xl font-semibold">Iniciar sesión</h1>
      {error && <p className="mb-4 text-sm text-[#f87171]">Correo o contraseña incorrectos</p>}
      <form action={login} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="correo@ejemplo.com"
          required
          className="rounded-md border border-[#1f3460] bg-[#1a1a2e] px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          required
          className="rounded-md border border-[#1f3460] bg-[#1a1a2e] px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-[#0f4c75] px-3 py-2 hover:bg-[#3282b8]">
          Entrar
        </button>
      </form>
      <p className="mt-4 text-sm">
        ¿No tienes cuenta?{" "}
        <a href="/register" className="text-[#3282b8]">
          Regístrate
        </a>
      </p>
    </main>
  );
}
