"use client";

import { useState } from "react";

function EyeIcon({ tachado }: { tachado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {tachado && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

function ToggleInput({
  name,
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  name: string;
  placeholder: string;
  autoComplete: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        required
        minLength={name === "claveNueva" ? 12 : undefined}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full rounded-md border border-border bg-sunken px-3 py-2 pr-10 text-sm transition-colors hover:border-border-strong focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        title={visible ? "Ocultar contraseña" : "Ver contraseña"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-muted"
      >
        <EyeIcon tachado={!visible} />
      </button>
    </div>
  );
}

const REGLAS = [
  { test: (v: string) => v.length >= 12, label: "Longitud mínima: 12 caracteres" },
  { test: (v: string) => /[A-Z]/.test(v), label: "1 mayúscula" },
  { test: (v: string) => /[a-z]/.test(v), label: "1 minúscula" },
  { test: (v: string) => /[0-9]/.test(v), label: "1 número" },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: "1 símbolo" },
];

export function PasswordChangeFields({ children }: { children?: React.ReactNode }) {
  const [claveNueva, setClaveNueva] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <ToggleInput name="claveActual" placeholder="Contraseña actual" autoComplete="current-password" />
      <ToggleInput
        name="claveNueva"
        placeholder="Nueva contraseña"
        autoComplete="new-password"
        value={claveNueva}
        onChange={setClaveNueva}
      />
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
        <ul className="flex flex-col gap-1 text-xs text-muted">
          {REGLAS.map((r) => {
            const ok = r.test(claveNueva);
            return (
              <li key={r.label} className={`flex items-center gap-1.5 ${ok ? "text-success" : ""}`}>
                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${ok ? "border-success/40 bg-success/15" : "border-white/10 bg-white/5"}`}>
                  {ok && (
                    <svg viewBox="0 0 20 20" fill="none" className="h-2 w-2" aria-hidden="true">
                      <path d="M4 10.5 8 14.5 16 5.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {r.label}
              </li>
            );
          })}
        </ul>
        <div className="sm:justify-self-start">{children}</div>
      </div>
    </div>
  );
}
