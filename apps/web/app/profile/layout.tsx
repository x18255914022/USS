import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetchServer } from "../../lib/serverApi";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const me = await apiFetchServer<{ user: { email: string; roles: string[] } | null }>("/api/auth/me").catch(() => ({
    user: null
  }));

  if (!me.user) redirect("/login");

  const canAdmin = me.user.roles.includes("admin") || me.user.roles.includes("manager");

  return (
    <div className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/schedule" className="text-sm font-semibold">
              Расписание
            </Link>
            <Link href="/profile" className="text-sm text-zinc-600 hover:text-zinc-900">
              Профиль
            </Link>
            {canAdmin ? (
              <>
                <Link href="/manager/editor" className="text-sm text-zinc-600 hover:text-zinc-900">
                  Редактор
                </Link>
                <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-900">
                  Admin
                </Link>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-500">{me.user.email}</div>
            <form action="/auth/logout" method="post">
              <button
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                type="submit"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

