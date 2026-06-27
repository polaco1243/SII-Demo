"use client";

import { useEffect, useRef, useState } from "react";

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("click", onClickFuera);
    return () => document.removeEventListener("click", onClickFuera);
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
        className="rounded-md px-2 py-1 text-lg leading-none text-text transition-colors hover:bg-surface-2"
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        ⋮
      </button>
      {abierto && (
        <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-md border border-border bg-surface py-1 shadow-pop">
          {children}
        </div>
      )}
    </div>
  );
}
