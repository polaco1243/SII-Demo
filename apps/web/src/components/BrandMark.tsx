export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 text-sm" : "h-9 w-9 text-base";

  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-[10px] font-bold text-bg shadow-[0_0_24px_rgba(234,88,12,0.45)] ${box}`}
        style={{ background: "linear-gradient(135deg, #ea580c, #fb923c)" }}
        aria-hidden="true"
      >
        Q
      </span>
      <span className="leading-tight">
        <span className="block font-bold tracking-wide text-text">QAR</span>
        <span className="block text-[0.6rem] font-medium tracking-[0.32em] text-faint">STUDIO</span>
      </span>
    </span>
  );
}
