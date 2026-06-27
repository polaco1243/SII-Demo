"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ activo, intervaloMs = 5000 }: { activo: boolean; intervaloMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => router.refresh(), intervaloMs);
    return () => clearInterval(id);
  }, [activo, intervaloMs, router]);

  return null;
}
