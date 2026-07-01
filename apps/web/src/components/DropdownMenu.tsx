"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState({ top: 0, right: 0 });
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onMouseDown = (e: MouseEvent) => {
      const enBoton = botonRef.current?.contains(e.target as Node);
      const enMenu = menuRef.current?.contains(e.target as Node);
      if (!enBoton && !enMenu) setAbierto(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [abierto]);

  const abrirMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (botonRef.current) {
      const rect = botonRef.current.getBoundingClientRect();
      setPosicion({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setAbierto((v) => !v);
  };

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={abrirMenu}
        className="rounded-md px-2 py-1 text-lg leading-none text-text transition-colors hover:bg-surface-2"
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        ⋮
      </button>
      {abierto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: posicion.top, right: posicion.right }}
            className="z-50 min-w-[160px] rounded-md border border-border bg-surface py-1 shadow-pop"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
