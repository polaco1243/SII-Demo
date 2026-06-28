import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { db, schema } from "@sii-demo/db";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { AuthForm } from "@/components/AuthForm";
import { BrandMark } from "@/components/BrandMark";

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

async function register(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    redirect("/login?tab=signup&error=datos_invalidos");
  }

  const passwordHash = await hash(password, 12);

  try {
    await db.insert(schema.users).values({ email, passwordHash });
  } catch {
    redirect("/login?tab=signup&error=correo_en_uso");
  }

  redirect("/login");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string }>;
}) {
  const { error, tab } = await searchParams;

  const registerError =
    error === "correo_en_uso" || error === "datos_invalidos" ? error : null;
  const loginError = error === "1";

  // Si hay error de registro o ?tab=signup, abrir el tab "Crear cuenta".
  const initialTab = registerError || tab === "signup" ? "signup" : "signin";

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12">
      {/* Glow ambiental decorativo, sutil, arriba-derecha */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-[10%] top-[12%] -z-10 h-[400px] w-[400px] rounded-full bg-accent/[0.04] blur-[120px]"
      />

      <div className="mb-6">
        <BrandMark />
      </div>

      <div
        className="auth-enter gradient-border-mask glass-panel w-full max-w-[440px] rounded-card p-8 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]"
      >
        <AuthForm
          initialTab={initialTab}
          loginAction={login}
          registerAction={register}
          loginError={loginError}
          registerError={registerError}
        />
      </div>
    </main>
  );
}
