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
        className="rounded-md px-2 py-1 text-lg leading-none text-[#eaeaea] hover:bg-[#1f3460]"
        aria-label="Más opciones"
      >
        ⋮
      </button>
      {abierto && (
        <div
          className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-md border border-[#1f3460] bg-[#16213e] py-1 shadow-lg"
          onClick={() => setAbierto(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
