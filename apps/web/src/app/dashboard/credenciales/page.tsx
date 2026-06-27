import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { encrypt } from "@sii-demo/crypto";
import { requireUserId } from "@/lib/session";

async function guardarCredencial(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const rut = String(formData.get("rut") ?? "").trim();
  const clave = String(formData.get("clave") ?? "");
  const emisor = String(formData.get("emisor") ?? "").trim();

  if (!rut || !clave || !emisor) {
    redirect("/dashboard/credenciales?error=1");
  }

  const claveEncrypted = encrypt(clave);

  await withUser(userId, async (tx) => {
    await tx.insert(schema.siiCredentials).values({ userId, rut, claveEncrypted, emisor });
  });

  redirect("/dashboard");
}

export default async function CredencialesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await requireUserId();
  const credenciales = await withUser(userId, (tx) =>
    tx.select().from(schema.siiCredentials).where(eq(schema.siiCredentials.userId, userId)),
  );

  return (
    <main className="mx-auto mt-12 max-w-lg p-6">
      <h1 className="mb-6 text-xl font-semibold">Credenciales SII</h1>

      {credenciales.length > 0 && (
        <ul className="mb-8 flex flex-col gap-2">
          {credenciales.map((c) => (
            <li key={c.id} className="rounded-md border border-[#1f3460] bg-[#16213e] p-3">
              <span className="font-medium">{c.emisor}</span> — RUT {c.rut}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mb-4 text-sm text-[#f87171]">Completa todos los campos</p>}

      <form action={guardarCredencial} className="flex flex-col gap-4">
        <input
          name="rut"
          placeholder="RUT (ej. 12345678-9)"
          required
          className="rounded-md border border-[#1f3460] bg-[#16213e] px-3 py-2"
        />
        <input
          name="clave"
          type="password"
          placeholder="Clave SII"
          required
          className="rounded-md border border-[#1f3460] bg-[#16213e] px-3 py-2"
        />
        <input
          name="emisor"
          placeholder="Nombre exacto del emisor en el portal"
          required
          className="rounded-md border border-[#1f3460] bg-[#16213e] px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-[#0f4c75] px-3 py-2 hover:bg-[#3282b8]">
          Guardar credencial
        </button>
      </form>
      <p className="mt-4 text-sm">
        La clave se cifra antes de guardarse y nunca se vuelve a mostrar.
      </p>
    </main>
  );
}
