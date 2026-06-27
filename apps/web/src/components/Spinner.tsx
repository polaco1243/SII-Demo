export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-4 w-4 animate-spin rounded-full border-2 border-[#1f3460] border-t-[#3282b8] ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
