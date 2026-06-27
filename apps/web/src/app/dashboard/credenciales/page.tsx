import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { encrypt } from "@sii-demo/crypto";
import { requireUserId } from "@/lib/session";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Spinner } from "@/components/Spinner";
import { DropdownMenu } from "@/components/DropdownMenu";

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
  const rut = String(formData.get("rut") ?? "");
  const nuevaClave = String(formData.get("nuevaClave") ?? "");

  if (!rut || !nuevaClave) {
    redirect("/dashboard/credenciales?error=clave_vacia");
  }

  const claveEncrypted = encrypt(nuevaClave);

  await withUser(userId, async (tx) => {
    await tx
      .update(schema.siiCredentials)
      .set({ claveEncrypted, updatedAt: new Date() })
      .where(and(eq(schema.siiCredentials.userId, userId), eq(schema.siiCredentials.rut, rut)));
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

async function eliminarPorRut(formData: FormData) {
  "use server";
  const userId = await requireUserId();
  const rut = String(formData.get("rut") ?? "");

  await withUser(userId, async (tx) => {
    await tx
      .delete(schema.siiCredentials)
      .where(and(eq(schema.siiCredentials.userId, userId), eq(schema.siiCredentials.rut, rut)));
  });

  redirect("/dashboard/credenciales");
}

export default async function CredencialesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; editando?: string }>;
}) {
  const { error, ok, editando } = await searchParams;
  const userId = await requireUserId();
  const credenciales = await withUser(userId, (tx) =>
    tx.select().from(schema.siiCredentials).where(eq(schema.siiCredentials.userId, userId)),
  );

  const hayTrabajoEnProceso = credenciales.some(
    (c) => c.status === "pendiente" || c.status === "descubriendo",
  );

  const grupos = new Map<string, typeof credenciales>();
  for (const c of credenciales) {
    const arr = grupos.get(c.rut) ?? [];
    arr.push(c);
    grupos.set(c.rut, arr);
  }

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

      {grupos.size > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 font-medium">Credenciales SII</h2>
          <ul className="flex flex-col gap-3">
            {Array.from(grupos.entries()).map(([rut, filas]) => {
              const cargando = filas.some((c) => c.status === "pendiente" || c.status === "descubriendo");
              const porConfirmar = filas.filter((c) => c.status === "pendiente_seleccion");
              const conError = filas.filter((c) => c.status === "error");
              const listas = filas.filter((c) => c.status === "lista");
              const editandoEsteRut = editando === rut;

              return (
                <li key={rut} className="rounded-md border border-[#1f3460] bg-[#16213e]">
                  <details open={editandoEsteRut}>
                    <summary className="flex cursor-pointer list-none items-center justify-between p-4">
                      <span className="flex items-center gap-3">
                        {cargando && <Spinner />}
                        <span>
                          <p className="font-medium">RUT {rut}</p>
                          <p className="text-sm text-[#a0aec0]">
                            {listas.length} razón{listas.length === 1 ? "" : "es"} social
                            {listas.length === 1 ? "" : "es"}
                          </p>
                        </span>
                      </span>
                      <DropdownMenu>
                        <Link
                          href={`/dashboard/credenciales?editando=${encodeURIComponent(rut)}`}
                          className="block px-4 py-2 text-sm hover:bg-[#1f3460]"
                        >
                          Editar clave
                        </Link>
                        <form action={eliminarPorRut}>
                          <input type="hidden" name="rut" value={rut} />
                          <button
                            type="submit"
                            className="block w-full px-4 py-2 text-left text-sm text-[#f87171] hover:bg-[#1f3460]"
                          >
                            Eliminar
                          </button>
                        </form>
                      </DropdownMenu>
                    </summary>

                    <div className="flex flex-col gap-3 border-t border-[#1f3460] p-4">
                      {editandoEsteRut && (
                        <form action={actualizarClave} className="flex gap-2 rounded-md bg-[#1a1a2e] p-3">
                          <input type="hidden" name="rut" value={rut} />
                          <input
                            name="nuevaClave"
                            type="password"
                            placeholder="Nueva clave SII"
                            required
                            autoFocus
                            className="flex-1 rounded-md border border-[#1f3460] bg-[#16213e] px-3 py-1.5 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded-md bg-[#0f4c75] px-3 py-1.5 text-sm hover:bg-[#3282b8]"
                          >
                            Guardar
                          </button>
                        </form>
                      )}

                      {cargando && (
                        <div className="flex items-center gap-2 text-sm">
                          <Spinner />
                          <span>Verificando con el SII… puede tardar hasta 30 segundos.</span>
                        </div>
                      )}

                      {porConfirmar.map((c) => (
                        <form key={c.id} action={confirmarEmisores}>
                          <input type="hidden" name="credencialId" value={c.id} />
                          <p className="mb-2 text-sm">Elige los emisores que vas a usar:</p>
                          <div className="flex flex-col gap-2">
                            {(c.emisoresDisponibles ?? []).map((texto) => {
                              const { razonSocial } = parseEmisor(texto);
                              return (
                                <label key={texto} className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" name="emisor" value={texto} />
                                  {razonSocial}
                                </label>
                              );
                            })}
                          </div>
                          <button
                            type="submit"
                            className="mt-3 rounded-md bg-[#0f4c75] px-3 py-2 text-sm hover:bg-[#3282b8]"
                          >
                            Confirmar selección
                          </button>
                        </form>
                      ))}

                      {listas.map((c) => (
                        <div key={c.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{c.emisorRazonSocial ?? c.emisor}</p>
                            <p className="text-sm text-[#a0aec0]">RUT emisor: {c.emisorRut ?? "—"}</p>
                          </div>
                          <form action={eliminarCredencial}>
                            <input type="hidden" name="credencialId" value={c.id} />
                            <button type="submit" className="text-sm text-[#f87171]">
                              Quitar
                            </button>
                          </form>
                        </div>
                      ))}

                      {conError.map((c) => (
                        <div key={c.id}>
                          <p className="text-sm text-[#f87171]">{c.errorMessage ?? "Error desconocido"}</p>
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
                      ))}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
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
