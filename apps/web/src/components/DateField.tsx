"use client";

import { useEffect, useRef, useState } from "react";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

function formatoISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function DateField({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder: string;
}) {
  const [valor, setValor] = useState(defaultValue ?? "");
  const [abierto, setAbierto] = useState(false);
  const fechaSeleccionada = parseISO(valor);
  const [vista, setVista] = useState(() => fechaSeleccionada ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const anioActual = new Date().getFullYear();
  // Rango amplio para saltar rápido entre años sin tener que dar click 15 veces.
  const anios = Array.from({ length: 21 }, (_, i) => anioActual - 15 + i);

  const primerDiaMes = new Date(vista.getFullYear(), vista.getMonth(), 1);
  const diasEnMes = new Date(vista.getFullYear(), vista.getMonth() + 1, 0).getDate();
  const offsetInicio = (primerDiaMes.getDay() + 6) % 7; // semana empieza en lunes

  const celdas: (number | null)[] = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  function elegirDia(dia: number) {
    setValor(formatoISO(new Date(vista.getFullYear(), vista.getMonth(), dia)));
    setAbierto(false);
  }

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={valor} />
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-sunken px-2 py-1.5 text-left text-sm transition-colors hover:border-border-strong focus:border-accent/40"
      >
        <span className={valor ? "text-text" : "text-faint"}>{valor || placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-faint">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {abierto && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-surface-deep p-3 shadow-pop">
          <div className="mb-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVista(new Date(vista.getFullYear(), vista.getMonth() - 1, 1))}
              className="rounded p-1 text-muted transition-colors hover:bg-white/5 hover:text-text"
            >
              ‹
            </button>
            <select
              value={vista.getMonth()}
              onChange={(e) => setVista(new Date(vista.getFullYear(), Number(e.target.value), 1))}
              className="flex-1 rounded border border-border bg-sunken px-1 py-1 text-xs"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={vista.getFullYear()}
              onChange={(e) => setVista(new Date(Number(e.target.value), vista.getMonth(), 1))}
              className="rounded border border-border bg-sunken px-1 py-1 text-xs"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setVista(new Date(vista.getFullYear(), vista.getMonth() + 1, 1))}
              className="rounded p-1 text-muted transition-colors hover:bg-white/5 hover:text-text"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-faint">
            {DIAS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {celdas.map((dia, i) => {
              if (dia === null) return <span key={i} />;
              const esSeleccionado =
                fechaSeleccionada &&
                fechaSeleccionada.getDate() === dia &&
                fechaSeleccionada.getMonth() === vista.getMonth() &&
                fechaSeleccionada.getFullYear() === vista.getFullYear();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => elegirDia(dia)}
                  className={`rounded py-1 transition-colors ${
                    esSeleccionado ? "bg-accent font-medium text-bg" : "text-text hover:bg-white/5"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>
          {valor && (
            <button
              type="button"
              onClick={() => {
                setValor("");
                setAbierto(false);
              }}
              className="mt-2 w-full rounded border border-border py-1 text-xs text-muted transition-colors hover:text-text"
            >
              Quitar fecha
            </button>
          )}
        </div>
      )}
    </div>
  );
}
