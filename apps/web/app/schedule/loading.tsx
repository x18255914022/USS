export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="h-10 w-64 animate-pulse rounded-lg bg-zinc-200" />
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-zinc-100 px-4 py-4 last:border-0">
            <div className="h-9 w-20 shrink-0 animate-pulse rounded-lg bg-zinc-200" />
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-9 flex-1 animate-pulse rounded-lg bg-zinc-200" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
