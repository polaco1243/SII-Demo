export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}
