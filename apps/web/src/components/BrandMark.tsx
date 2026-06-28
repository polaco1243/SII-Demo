export function BrandMark({ size = "md", showLabel = true }: { size?: "sm" | "md"; showLabel?: boolean }) {
  const box = size === "sm" ? "h-8 w-8 text-sm" : "h-[38px] w-[38px] text-[0.95rem]";

  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-[10px] font-bold ${box}`}
        style={{
          background: "linear-gradient(135deg, #d97706, #f59e0b)",
          color: "#05080f",
          boxShadow: "0 0 24px rgba(217,119,6,0.45)",
        }}
        aria-hidden="true"
      >
        Q
      </span>
      {showLabel && (
        <span className="font-head leading-tight" style={{ fontWeight: 700, letterSpacing: "0.02em", color: "#fff" }}>
          QAR
          <small className="mt-px block text-[0.6rem] font-medium tracking-[0.32em]" style={{ color: "#94a3b8" }}>
            STUDIO
          </small>
        </span>
      )}
    </span>
  );
}
