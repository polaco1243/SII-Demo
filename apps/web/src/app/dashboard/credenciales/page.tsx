import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { encrypt } from "@sii-demo/crypto";
import { requireUserId } from "@/lib/session";
import { AutoRefresh } from "@/components/AutoRefresh";

const RUT_EMISOR_RE = /^([\d.]+-[\dkK])\s+(.*)$/;

function parseEmisor(texto: string): { rut: string; razonSocial: string } {
  const match = texto.match(RUT_EMISOR_RE);
  if (match) return { rut: match[1], razonSocial: match[2].trim() };
  return { rut: "", razonSocial: texto };
}

async function agregarCredencial(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const rut = String(formData.get("rut") ?? "").trim();
  const clave = String(formData.get("clave") ?? "");

  if (!rut || !clave) {
    redirect("/dashboard/credenciales?error=campos");
  }

  const claveEncrypted = encrypt(clave);

  await withUser(userId, async (tx) => {
    await tx.insert(schema.siiCredentials).values({ userId, rut, claveEncrypted, status: "pendiente" });
  });

  redirect("/dashboard/credenciales");
}

async function confirmarEmisores(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const credencialId = String(formData.get("credencialId") ?? "");
  const seleccionados = formData.getAll("emisor").map(String);

  if (!credencialId || seleccionados.length === 0) {
    redirect("/dashboard/credenciales?error=sin_seleccion");
  }

  await withUser(userId, async (tx) => {
    const [credencial] = await tx
      .select()
      .from(schema.siiCredentials)
      .where(and(eq(schema.siiCredentials.id, credencialId), eq(schema.siiCredentials.userId, userId)));

    if (!credencial) throw new Error("Credencial no encontrada");

    for (const textoExacto of seleccionados) {
      const { rut: emisorRut, razonSocial } = parseEmisor(textoExacto);
      await tx.insert(schema.siiCredentials).values({
        userId,
        rut: credencial.rut,
        claveEncrypted: credencial.claveEncrypted,
        emisor: textoExacto,
        emisorRut,
        emisorRazonSocial: razonSocial,
        status: "lista",
      });
    }

    await tx.delete(schema.siiCredentials).where(eq(schema.siiCredentials.id, credencialId));
  });

  redirect("/dashboard/credenciales");
}

async function reintentarDescubrimiento(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const credencialId = String(formData.get("credencialId") ?? "");

  await withUser(userId, async (tx) => {
    await tx
      .update(schema.siiCredentials)
      .set({ status: "pendiente", errorMessage: null, updatedAt: new Date() })
      .where(and(eq(schema.siiCredentials.id, credencialId), eq(schema.siiCredentials.userId, userId)));
  });

  redirect("/dashboard/credenciales");
}

async function actualizarClave(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const credencialId = String(formData.get("credencialId") ?? "");
  const nuevaClave = String(formData.get("nuevaClave") ?? "");

  if (!nuevaClave) {
    redirect("/dashboard/credenciales?error=clave_vacia");
  }

  const claveEncrypted = encrypt(nuevaClave);

  await withUser(userId, async (tx) => {
    const [credencial] = await tx
      .select()
      .from(schema.siiCredentials)
      .where(and(eq(schema.siiCredentials.id, credencialId), eq(schema.siiCredentials.userId, userId)));

    if (!credencial) throw new Error("Credencial no encontrada");

    await tx
      .update(schema.siiCredentials)
      .set({ claveEncrypted, updatedAt: new Date() })
      .where(and(eq(schema.siiCredentials.userId, userId), eq(schema.siiCredentials.rut, credencial.rut)));
  });

  redirect("/dashboard/credenciales?ok=clave_actualizada");
}

async function eliminarCredencial(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const credencialId = String(formData.get("credencialId") ?? "");

  await withUser(userId, async (tx) => {
    await tx
      .delete(schema.siiCredentials)
      .where(and(eq(schema.siiCredentials.id, credencialId), eq(schema.siiCredentials.userId, userId)));
  });

  redirect("/dashboard/credenciales");
}

export default async function CredencialesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const userId = await requireUserId();
  const credenciales = await withUser(userId, (tx) =>
    tx.select().from(schema.siiCredentials).where(eq(schema.siiCredentials.userId, userId)),
  );

  const hayTrabajoEnProceso = credenciales.some(
    (c) => c.status === "pendiente" || c.status === "descubriendo",
  );

  return (
    <main className="mx-auto mt-12 max-w-lg p-6">
      <AutoRefresh activo={hayTrabajoEnProceso} />
      <a href="/dashboard" className="text-sm text-[#3282b8]">
        ← Volver
      </a>
      <h1 className="mb-6 mt-2 text-xl font-semibold">Credenciales SII</h1>

      {error === "campos" && <p className="mb-4 text-sm text-[#f87171]">Completa RUT y clave</p>}
      {error === "sin_seleccion" && (
        <p className="mb-4 text-sm text-[#f87171]">Selecciona al menos un emisor</p>
      )}
      {error === "clave_vacia" && <p className="mb-4 text-sm text-[#f87171]">Escribe la nueva clave</p>}
      {ok === "clave_actualizada" && (
        <p className="mb-4 text-sm text-[#4ade80]">Clave actualizada correctamente</p>
      )}

      {credenciales.length > 0 && (
        <ul className="mb-8 flex flex-col gap-3">
          {credenciales.map((c) => (
            <li key={c.id} className="rounded-md border border-[#1f3460] bg-[#16213e] p-4">
              {(c.status === "pendiente" || c.status === "descubriendo") && (
                <div>
                  <p className="text-sm">Verificando credenciales con el SII para RUT {c.rut}…</p>
                  <p className="mt-1 text-xs text-[#3282b8]">Puede tardar hasta 30 segundos. Esta página se actualiza sola.</p>
                </div>
              )}

              {c.status === "pendiente_seleccion" && c.emisoresDisponibles && (
                <form action={confirmarEmisores}>
                  <input type="hidden" name="credencialId" value={c.id} />
                  <p className="mb-2 text-sm">RUT {c.rut} — elige los emisores que vas a usar:</p>
                  <div className="flex flex-col gap-2">
                    {c.emisoresDisponibles.map((texto) => {
                      const { razonSocial } = parseEmisor(texto);
                      return (
                        <label key={texto} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="emisor" value={texto} />
                          {razonSocial}
                        </label>
                      );
                    })}
                  </div>
                  <button type="submit" className="mt-3 rounded-md bg-[#0f4c75] px-3 py-2 text-sm hover:bg-[#3282b8]">
                    Confirmar selección
                  </button>
                </form>
              )}

              {c.status === "lista" && (
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{c.emisorRazonSocial ?? c.emisor}</p>
                      <p className="text-sm">RUT emisor: {c.emisorRut ?? "—"} (cuenta {c.rut})</p>
                    </div>
                    <form action={eliminarCredencial}>
                      <input type="hidden" name="credencialId" value={c.id} />
                      <button type="submit" className="text-sm text-[#f87171]">
                        Eliminar
                      </button>
                    </form>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-[#3282b8]">Cambiar clave</summary>
                    <form action={actualizarClave} className="mt-2 flex gap-2">
                      <input type="hidden" name="credencialId" value={c.id} />
                      <input
                        name="nuevaClave"
                        type="password"
                        placeholder="Nueva clave SII"
                        required
                        className="flex-1 rounded-md border border-[#1f3460] bg-[#1a1a2e] px-3 py-1.5 text-sm"
                      />
                      <button type="submit" className="rounded-md bg-[#0f4c75] px-3 py-1.5 text-sm hover:bg-[#3282b8]">
                        Guardar
                      </button>
                    </form>
                  </details>
                </div>
              )}

              {c.status === "error" && (
                <div>
                  <p className="text-sm text-[#f87171]">RUT {c.rut}: {c.errorMessage ?? "Error desconocido"}</p>
                  <div className="mt-2 flex gap-3">
                    <form action={reintentarDescubrimiento}>
                      <input type="hidden" name="credencialId" value={c.id} />
                      <button type="submit" className="text-sm text-[#3282b8]">
                        Reintentar
                      </button>
                    </form>
                    <form action={eliminarCredencial}>
                      <input type="hidden" name="credencialId" value={c.id} />
                      <button type="submit" className="text-sm text-[#f87171]">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 font-medium">Agregar credencial SII</h2>
      <form action={agregarCredencial} className="flex flex-col gap-4">
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
        <button type="submit" className="rounded-md bg-[#0f4c75] px-3 py-2 hover:bg-[#3282b8]">
          Verificar credencial
        </button>
      </form>
      <p className="mt-4 text-sm">
        La clave se cifra antes de guardarse. Tras verificarla, vas a elegir con qué emisor(es) emitir.
      </p>
    </main>
  );
}
