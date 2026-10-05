import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetchServer } from "../../lib/serverApi";

const NAV = [
  { href: "/admin/faculties", label: "Факультеты" },
  { href: "/admin/departments", label: "Кафедры" },
  { href: "/admin/buildings", label: "Корпуса" },
  { href: "/admin/room-types", label: "Типы аудиторий" },
  { href: "/admin/rooms", label: "Аудитории" },
  { href: "/admin/subjects", label: "Предметы" },
  { href: "/admin/lesson-types", label: "Типы занятий" },
  { href: "/admin/groups", label: "Группы" },
  { href: "/admin/stream-groups", label: "Потоки" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/semesters", label: "Семестры" },
  { href: "/manager/weeks", label: "Недели" },
  { href: "/manager/lessons", label: "Занятия" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await apiFetchServer<{ user: { email: string; roles: string[] } | null }>("/api/auth/me").catch(() => ({
    user: null
  }));

  if (!me.user) redirect("/login");
  const canAdmin = me.user.roles.includes("admin") || me.user.roles.includes("manager");
  if (!canAdmin) redirect("/");

  return (
    <div className="min-h-full flex flex-1 flex-col bg-zinc-50 text-zinc-900 md:flex-row">
      <aside className="w-full shrink-0 border-b border-zinc-200 bg-white px-4 py-4 md:w-72 md:border-b-0 md:border-r md:py-6">
        <Link href="/" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-50">
          University Schedule
        </Link>

        <div className="mt-4 px-3 text-xs text-zinc-500">{me.user.email}</div>

        <nav className="mt-2 flex flex-wrap gap-1 md:mt-4 md:flex-col">
          {NAV.map((item) => {
            const active = false;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm",
                  active ? "bg-zinc-900 text-white" : "hover:bg-zinc-50"
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form action="/auth/logout" method="post">
          <button
            className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 md:mt-6"
            type="submit"
          >
            Выйти
          </button>
        </form>
      </aside>

      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
