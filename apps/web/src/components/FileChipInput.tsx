"use client";

import { useRef, useState } from "react";

export function FileChipInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState<string | null>(null);

  return (
    <div>
      <input
        ref={inputRef}
        name="csv"
        type="file"
        accept=".csv"
        required
        onChange={(e) => setNombre(e.target.files?.[0]?.name ?? null)}
        className={
          nombre
            ? "sr-only"
            : "text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:bg-border"
        }
      />
      {nombre && (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-caption font-medium text-success shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]">
          <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 shrink-0" aria-hidden="true">
            <path
              d="M6 2.5h5l3 3v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M11 2.5V6h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          <span className="truncate">{nombre}</span>
          <button
            type="button"
            onClick={() => {
              setNombre(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="ml-0.5 shrink-0 rounded-full p-0.5 transition-colors hover:bg-success/20"
            title="Quitar archivo"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden="true">
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      )}
    </div>
  );
}
