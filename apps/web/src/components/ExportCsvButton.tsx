"use client";

import { useState } from "react";

export function ExportCsvButton({ href }: { href: string }) {
  const [exportando, setExportando] = useState(false);

  return (
    <span className="relative inline-flex">
      <a
        href={href}
        onClick={() => {
          setExportando(true);
          setTimeout(() => setExportando(false), 2500);
        }}
        className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-[#d4d4d8] transition-colors hover:bg-white/[0.1] hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Exportar CSV
      </a>
      {exportando && (
        <span className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-md border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success shadow-pop">
          Generando CSV…
        </span>
      )}
    </span>
  );
}
