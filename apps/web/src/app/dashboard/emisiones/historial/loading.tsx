export default function Loading() {
  return (
    <div className="fade-in mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-4 flex gap-1 border-b border-border">
        <div className="h-9 w-24 animate-pulse rounded-t bg-white/5" />
        <div className="h-9 w-36 animate-pulse rounded-t bg-white/5" />
        <div className="h-9 w-40 animate-pulse rounded-t bg-white/5" />
      </div>
      <div className="mb-6 h-14 w-full max-w-md animate-pulse rounded-md bg-white/5" />
      <div className="mb-4 h-9 w-full max-w-lg animate-pulse rounded-md bg-white/5" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
