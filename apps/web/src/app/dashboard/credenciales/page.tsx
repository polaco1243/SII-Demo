import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { withUser, schema } from "@sii-demo/db";
import { encrypt } from "@sii-demo/crypto";
import { requireUserId } from "@/lib/session";
import { validarRut } from "@/lib/rut";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Spinner } from "@/components/Spinner";
import { DropdownMenu } from "@/components/DropdownMenu";
import { DismissibleBanner } from "@/components/DismissibleBanner";
import { Tooltip } from "@/components/Tooltip";

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

  if (!validarRut(rut)) {
    redirect("/dashboard/credenciales?error=rut_invalido");
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
      .update(schema.siiCredentials)
      .set({ activa: false, updatedAt: new Date() })
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
      .update(schema.siiCredentials)
      .set({ activa: false, updatedAt: new Date() })
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
    tx
      .select()
      .from(schema.siiCredentials)
      .where(and(eq(schema.siiCredentials.userId, userId), eq(schema.siiCredentials.activa, true))),
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
    <div className="fade-in mx-auto max-w-3xl p-4 md:p-8">
      <AutoRefresh activo={hayTrabajoEnProceso} />
      <h1 className="mb-6 border-b border-border pb-5 text-page">Credenciales SII</h1>

      {error === "campos" && <p className="mb-4 text-sm text-danger">Completa RUT y clave</p>}
      {error === "rut_invalido" && (
        <p className="mb-4 text-sm text-danger">El RUT ingresado no es válido (revisa el dígito verificador)</p>
      )}
      {error === "sin_seleccion" && (
        <p className="mb-4 text-sm text-danger">Selecciona al menos un emisor</p>
      )}
      {error === "clave_vacia" && <p className="mb-4 text-sm text-danger">Escribe la nueva clave</p>}
      {ok === "clave_actualizada" && (
        <p className="mb-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Clave actualizada correctamente
        </p>
      )}

      <details open={grupos.size === 0} className="group mb-10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/70 to-black p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
          <span className="flex items-center gap-3">
            <span className="text-accent transition-transform duration-200 group-open:rotate-90">▶</span>
            <h2 className="text-section">Agregar credencial SII</h2>
          </span>
          <Tooltip texto="Tu clave del SII se transforma con AES-256-GCM, el mismo estándar que usan bancos y gobiernos. Ni con acceso directo a la base de datos se puede leer tu clave sin la llave de cifrado del servidor.">
            <span className="inline-flex shrink-0 cursor-help items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-caption font-medium text-success shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]">
              <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
                <path
                  d="M10 2.5 4 5v4.5c0 3.5 2.4 6.4 6 7.5 3.6-1.1 6-4 6-7.5V5l-6-2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              Cifrado AES-256
            </span>
          </Tooltip>
        </summary>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/70 to-black p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]">
            <form action={agregarCredencial} className="flex flex-col gap-4">
              <input
                name="rut"
                placeholder="RUT (ej. 12345678-9)"
                required
                className="rounded-md border border-border bg-sunken px-3 py-2 transition-colors hover:border-border-strong focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
              />
              <input
                name="clave"
                type="password"
                placeholder="Clave SII"
                required
                className="rounded-md border border-border bg-sunken px-3 py-2 transition-colors hover:border-border-strong focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="submit"
                className="btn-primary rounded-md px-3 py-2"
              >
                Verificar credencial
              </button>
            </form>
            <p className="mt-4 text-sm text-muted">
              La clave se cifra antes de guardarse. Tras verificarla, vas a elegir con qué emisor(es) emitir.
            </p>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-section">Qué pasa después</h2>
            <ul className="flex flex-col gap-3.5 text-sm text-muted">
              {[
                "Verificamos tu RUT y clave contra el SII",
                "Detectamos automáticamente tus razones sociales",
                "Eliges cuáles activar",
              ].map((texto) => (
                <li key={texto} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 text-success" aria-hidden="true">
                      <path d="M4 10.5 8 14.5 16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>{texto}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </details>

      {grupos.size > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-section">Tus credenciales</h2>
          <ul className="flex flex-col gap-3">
            {Array.from(grupos.entries()).map(([rut, filas]) => {
              const cargando = filas.some((c) => c.status === "pendiente" || c.status === "descubriendo");
              const porConfirmar = filas.filter((c) => c.status === "pendiente_seleccion");
              const conError = filas.filter((c) => c.status === "error");
              const listas = filas.filter((c) => c.status === "lista");
              const editandoEsteRut = editando === rut;
              const totalDetectados = porConfirmar.reduce(
                (acc, c) => acc + (c.emisoresDisponibles?.length ?? 0),
                0,
              );

              const necesitaAtencion = porConfirmar.length > 0 || conError.length > 0;

              return (
                <li
                  key={rut}
                  className="glass-panel gradient-border bento-card overflow-hidden rounded-xl shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]"
                >
                  <details open={editandoEsteRut || necesitaAtencion} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between p-4 transition-colors hover:bg-surface-2">
                      <span className="flex items-center gap-3">
                        <span className="text-accent transition-transform duration-200 group-open:rotate-90">▶</span>
                        {cargando && <Spinner />}
                        <span>
                          <p className="flex items-center font-medium">
                            RUT {rut}
                            {necesitaAtencion && (
                              <span className="ml-2 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-caption font-medium text-warning">
                                requiere acción
                              </span>
                            )}
                          </p>
                          {!cargando && (
                            <p className="text-sm text-muted">
                              {listas.length} razón{listas.length === 1 ? "" : "es"} social
                              {listas.length === 1 ? "" : "es"} — clic para ver el detalle
                            </p>
                          )}
                        </span>
                      </span>
                      <DropdownMenu>
                        <Link
                          href={`/dashboard/credenciales?editando=${encodeURIComponent(rut)}`}
                          className="block px-4 py-2 text-sm transition-colors hover:bg-surface-2"
                        >
                          Editar clave
                        </Link>
                        <form action={eliminarPorRut}>
                          <input type="hidden" name="rut" value={rut} />
                          <button
                            type="submit"
                            className="block w-full px-4 py-2 text-left text-sm text-danger transition-colors hover:bg-surface-2"
                          >
                            Eliminar
                          </button>
                        </form>
                      </DropdownMenu>
                    </summary>

                    <div className="flex flex-col gap-3 border-t border-border p-4">
                      {editandoEsteRut && (
                        <form action={actualizarClave} className="flex gap-2 rounded-md border border-border bg-sunken p-3">
                          <input type="hidden" name="rut" value={rut} />
                          <input
                            name="nuevaClave"
                            type="password"
                            placeholder="Nueva clave SII"
                            required
                            autoFocus
                            className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-border-strong focus:border-border-strong"
                          />
                          <button
                            type="submit"
                            className="btn-primary rounded-md px-3 py-1.5 text-sm"
                          >
                            Guardar
                          </button>
                          <Link
                            href="/dashboard/credenciales"
                            className="flex items-center rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
                          >
                            Cancelar
                          </Link>
                        </form>
                      )}

                      {cargando && (
                        <div className="flex items-center gap-2 text-sm text-muted">
                          <Spinner />
                          <span>Verificando con el SII… puede tardar hasta 30 segundos.</span>
                        </div>
                      )}

                      {porConfirmar.length > 0 && (
                        <DismissibleBanner>
                          Se encontraron {totalDetectados} razón{totalDetectados === 1 ? "" : "es"} social
                          {totalDetectados === 1 ? "" : "es"} disponible{totalDetectados === 1 ? "" : "s"}
                        </DismissibleBanner>
                      )}

                      {porConfirmar.map((c) => (
                        <form key={c.id} action={confirmarEmisores}>
                          <input type="hidden" name="credencialId" value={c.id} />
                          <p className="mb-2 text-sm text-muted">Elige los emisores que vas a usar:</p>
                          <div className="flex flex-col gap-2">
                            {(c.emisoresDisponibles ?? []).map((texto) => {
                              const { razonSocial } = parseEmisor(texto);
                              return (
                                <label
                                  key={texto}
                                  className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-sunken px-3 py-2 text-sm transition-colors hover:border-border-strong"
                                >
                                  <input type="checkbox" name="emisor" value={texto} className="accent-accent" />
                                  {razonSocial}
                                </label>
                              );
                            })}
                          </div>
                          <button
                            type="submit"
                            className="btn-primary mt-3 rounded-md px-3 py-2 text-sm"
                          >
                            Confirmar selección
                          </button>
                        </form>
                      ))}

                      {listas.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-md border border-border bg-sunken px-3 py-2.5"
                        >
                          <div>
                            <p className="font-medium">{c.emisorRazonSocial ?? c.emisor}</p>
                            <p className="text-sm text-muted">RUT emisor: {c.emisorRut ?? "—"}</p>
                          </div>
                          <form action={eliminarCredencial}>
                            <input type="hidden" name="credencialId" value={c.id} />
                            <button type="submit" className="rounded text-sm text-danger transition-colors hover:text-accent-hover">
                              Quitar
                            </button>
                          </form>
                        </div>
                      ))}

                      {conError.map((c) => (
                        <div key={c.id} className="rounded-md border border-danger/30 bg-danger/10 p-3">
                          <p className="text-sm text-danger">{c.errorMessage ?? "Error desconocido"}</p>
                          <div className="mt-2 flex gap-3">
                            <form action={reintentarDescubrimiento}>
                              <input type="hidden" name="credencialId" value={c.id} />
                              <button type="submit" className="rounded text-sm font-medium text-accent transition-colors hover:text-accent-hover">
                                Reintentar
                              </button>
                            </form>
                            <form action={eliminarCredencial}>
                              <input type="hidden" name="credencialId" value={c.id} />
                              <button type="submit" className="rounded text-sm text-danger transition-colors hover:opacity-80">
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
    </div>
  );
}
