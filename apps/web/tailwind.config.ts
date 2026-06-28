import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aura Affiliate — near-black base
        bg: "#050505",
        "surface-deep": "#0a0a0a",
        surface: "#171717", // sólido: inputs/selects/popovers (no glass)
        "surface-2": "#1f1f1f", // hover sobre superficie sólida
        sunken: "#121212",

        border: "rgba(255,255,255,0.08)",
        "border-strong": "rgba(255,255,255,0.16)",

        // Marca: naranja
        primary: "#ea580c",
        "primary-hover": "#f97316",
        accent: "#f97316", // links, chevrons, énfasis interactivo
        "accent-hover": "#fb923c",

        // Estados semánticos
        danger: "#ef4444",
        success: "#10b981", // emerald — reservado para "positivo"/"emitida"
        warning: "#f97316", // "requiere acción" = llamado a la acción, mismo naranja de marca
        info: "#a855f7", // procesando / en curso

        text: "#ffffff",
        muted: "#a3a3a3",
        faint: "#525252",
      },
      fontSize: {
        caption: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.35rem" }],
        base: ["1rem", { lineHeight: "1.55rem" }],
        section: ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "500" }],
        page: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "500" }],
      },
      borderRadius: {
        card: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.4)",
        pop: "0 8px 24px rgba(0,0,0,0.6)",
      },
      ringColor: {
        focus: "#f97316",
      },
    },
  },
  plugins: [],
};

export default config;
