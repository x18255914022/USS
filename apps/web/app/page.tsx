export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-900">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">University Schedule</h1>
        <p className="mt-2 text-sm text-zinc-600">v0.1 scaffold. Auth + RBAC + CRUD справочников.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" href="/login">
            Войти
          </a>
          <a className="inline-flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50" href="/admin">
            Админ-панель
          </a>
        </div>
      </main>
    </div>
  );
}
