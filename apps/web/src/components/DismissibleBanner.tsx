"use client";

import { useState } from "react";

export function DismissibleBanner({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="flex items-center justify-between rounded-md border border-accent/40 bg-info/15 px-3 py-2 text-sm text-text">
      <span>{children}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="ml-3 rounded text-muted transition-colors hover:text-text"
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}
