import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Superficies (de más oscura a más clara)
        bg: "#1a1a2e", // fondo base de la app
        surface: "#16213e", // tarjetas / paneles
        "surface-2": "#1c2c52", // superficie elevada: filas internas, hover de menús
        sunken: "#141d33", // superficie hundida: inputs sobre una card, wells

        // Bordes
        border: "#1f3460",
        "border-strong": "#2a4575", // borde de input enfocado / divisores destacados

        // Marca / acciones
        primary: "#0f4c75", // botón primario (fondo)
        "primary-hover": "#15639a", // hover del botón primario (sube contraste vs #3282b8)
        accent: "#3282b8", // enlaces, chevrons, foco, énfasis interactivo
        "accent-hover": "#54a3d6",

        // Estados semánticos
        danger: "#f87171",
        success: "#4ade80",
        warning: "#fbbf24",
        info: "#3282b8",

        // Texto
        text: "#eaeaea", // texto principal
        muted: "#aeb9cc", // texto secundario (AA sobre todas las superficies)
        faint: "#8793aa", // texto terciario / placeholders
      },
      fontSize: {
        // Escala tipográfica con line-heights coherentes
        caption: ["0.75rem", { lineHeight: "1rem" }], // 12px — badges, hints
        sm: ["0.875rem", { lineHeight: "1.35rem" }], // 14px — body secundario, tablas
        base: ["1rem", { lineHeight: "1.55rem" }], // 16px — body
        "section": ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "600" }], // 17px — títulos de sección
        "page": ["1.375rem", { lineHeight: "1.85rem", letterSpacing: "-0.01em", fontWeight: "600" }], // 22px — H1
      },
      borderRadius: {
        card: "0.625rem", // 10px — tarjetas/paneles
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.25)",
        pop: "0 8px 24px rgba(0,0,0,0.45)",
      },
      ringColor: {
        focus: "#54a3d6",
      },
    },
  },
  plugins: [],
};

export default config;
