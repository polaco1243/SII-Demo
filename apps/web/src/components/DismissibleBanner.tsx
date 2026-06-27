"use client";

import { useState } from "react";

export function DismissibleBanner({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="flex items-center justify-between rounded-md bg-[#0f4c75] px-3 py-2 text-sm">
      <span>{children}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="ml-3 text-[#eaeaea] hover:text-white"
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}
