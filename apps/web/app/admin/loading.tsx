export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-56 animate-pulse rounded-lg bg-zinc-200" />
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-zinc-200" />
        ))}
      </div>
    </div>
  );
}
