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
    <main className="mx-auto mt-24 max-w-sm rounded-lg border border-[#1f3460] bg-[#16213e] p-8">
      <h1 className="mb-6 text-xl font-semibold">Crear cuenta</h1>
      {error === "correo_en_uso" && (
        <p className="mb-4 text-sm text-[#f87171]">Ese correo ya está registrado</p>
      )}
      {error === "datos_invalidos" && (
        <p className="mb-4 text-sm text-[#f87171]">Correo inválido o contraseña muy corta (mínimo 8)</p>
      )}
      <form action={register} className="flex flex-col gap-4">
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
          placeholder="Contraseña (mínimo 8 caracteres)"
          minLength={8}
          required
          className="rounded-md border border-[#1f3460] bg-[#1a1a2e] px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-[#0f4c75] px-3 py-2 hover:bg-[#3282b8]">
          Crear cuenta
        </button>
      </form>
      <p className="mt-4 text-sm">
        ¿Ya tienes cuenta?{" "}
        <a href="/login" className="text-[#3282b8]">
          Inicia sesión
        </a>
      </p>
    </main>
  );
}
