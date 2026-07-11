"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard/emisiones", label: "Boletas" },
  { href: "/dashboard/emisiones/historial", label: "Historial completo" },
  { href: "/dashboard/emisiones/bitacora", label: "Bitácora de auditoría" },
];

export function EmisionesSubNav() {
  const pathname = usePathname();

  return (
    <div className="mb-4 flex gap-1 border-b border-border">
      {ITEMS.map((item) => {
        const activo = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activo ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
