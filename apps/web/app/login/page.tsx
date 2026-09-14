import Link from "next/link";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = sp.error ? "Неверные учётные данные или нет прав." : null;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-900">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Вход</h1>
          <p className="text-sm text-zinc-600">JWT access token + refresh cookie.</p>
        </div>

        <form className="mt-7 flex flex-col gap-4" action="/auth/login" method="post">
          <div className="flex flex-col gap-2 text-sm">
            <label htmlFor="email" className="text-zinc-700">
              Email <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none ring-0 transition-all focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/20"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              defaultValue="admin@example.com"
              required
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <label htmlFor="password" className="text-zinc-700">
              Пароль <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="password"
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none ring-0 transition-all focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/20"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              defaultValue="admin12345"
              required
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          {error ? (
            <div id="login-error" className="text-sm text-red-600" role="alert" aria-live="polite">
              {error}
            </div>
          ) : null}

          <button
            className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            type="submit"
          >
            Войти
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-600">
          Нет аккаунта?{" "}
          <Link className="font-medium text-zinc-900 hover:underline" href="/register">
            Регистрация
          </Link>
        </div>
      </main>
    </div>
  );
}
