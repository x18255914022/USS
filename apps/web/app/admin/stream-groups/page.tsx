import Link from "next/link";
import { apiFetchServer } from "../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

type GroupItem = { id: string; name: string };
type StreamGroupItem = { id: string; name: string; entries: { groupId: string; group: GroupItem }[] };

export default async function StreamGroupsPage() {
  const groups = await apiFetchServer<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100");
  const streams = await apiFetchServer<PageResult<StreamGroupItem>>("/api/stream-groups?page=1&pageSize=100");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Потоки</h1>
          <div className="mt-1 text-sm text-zinc-600">API: /api/stream-groups</div>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold tracking-tight">Создать поток</h2>

        <form className="mt-4 grid gap-4 lg:max-w-2xl" action="/admin/stream-groups/action" method="post">
          <input type="hidden" name="actionType" value="create" />

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Название</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
              name="name"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Группы</span>
            <select
              className="h-40 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
              name="groupIds"
              multiple
            >
              {groups.items.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-zinc-500">Можно выбрать несколько (Ctrl/⌘ + клик).</div>
          </label>

          <button
            className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            type="submit"
          >
            Создать
          </button>
        </form>
      </section>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Группы</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {streams.items.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">{s.name}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {s.entries.map((e) => e.group.name).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 inline-flex items-center"
                        href={`/admin/stream-groups/edit/${s.id}`}
                      >
                        Редактировать
                      </Link>
                      <form action="/admin/stream-groups/action" method="post">
                        <input type="hidden" name="actionType" value="delete" />
                        <input type="hidden" name="id" value={s.id} />
                        <button
                          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50"
                          type="submit"
                        >
                          Удалить
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {streams.items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={3}>
                    Пусто
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600">Total: {streams.total}</div>
      </div>
    </div>
  );
}

