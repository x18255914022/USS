import { apiFetchServer } from "../../lib/serverApi";

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const error = typeof sp.error === "string" ? sp.error : null;

  const me = await apiFetchServer<{ user: { email: string; telegramChatId?: string | null } | null }>("/api/auth/me").catch(
    () => ({ user: null })
  );

  const linked = !!me.user?.telegramChatId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Профиль</h1>
        <p className="text-sm text-zinc-600">Привязка Telegram для просмотра расписания в боте.</p>
      </div>

      {ok ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Telegram привязан.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Не удалось привязать. Код неверный или истёк.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
        <div className="text-sm font-semibold">Telegram</div>
        <div className="text-sm text-zinc-700">
          Статус: {linked ? "привязан" : "не привязан"}
        </div>

        {!linked ? (
          <form className="flex flex-wrap items-end gap-3" action="/profile/action" method="post">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Код из бота</span>
              <input
                className="h-11 w-56 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="code"
                inputMode="numeric"
                placeholder="123456"
              />
            </label>
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              type="submit"
            >
              Привязать
            </button>
          </form>
        ) : (
          <div className="text-sm text-zinc-600">Chat ID: {me.user?.telegramChatId}</div>
        )}
      </section>
    </div>
  );
}

