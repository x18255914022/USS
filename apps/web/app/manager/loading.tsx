export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-72 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-4 w-56 animate-pulse rounded bg-zinc-200" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="h-11 w-80 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-11 w-64 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-11 w-48 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-11 w-32 animate-pulse rounded-lg bg-zinc-200" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr_360px]">
        <div className="h-96 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-zinc-200" />
      </div>
    </div>
  );
}
