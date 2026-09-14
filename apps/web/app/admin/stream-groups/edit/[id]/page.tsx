import Link from "next/link";
import { apiFetchServer } from "../../../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

type GroupItem = { id: string; name: string };
type StreamGroupItem = { id: string; name: string; entries: { groupId: string }[] };

export default async function StreamGroupEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const id = p.id;

  const groups = await apiFetchServer<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100");
  const { item } = await apiFetchServer<{ item: StreamGroupItem }>(`/api/stream-groups/${encodeURIComponent(id)}`);

  const selected = new Set(item.entries.map((e) => e.groupId));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Поток: редактирование</h1>
          <div className="mt-1 text-sm text-zinc-600">ID: {id}</div>
        </div>
        <Link className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50" href="/admin/stream-groups">
          Назад
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <form className="grid gap-4" action="/admin/stream-groups/action" method="post">
          <input type="hidden" name="actionType" value="update" />
          <input type="hidden" name="id" value={id} />

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Название</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
              name="name"
              defaultValue={item.name}
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Группы</span>
            <select
              className="h-56 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
              name="groupIds"
              multiple
              defaultValue={Array.from(selected)}
            >
              {groups.items.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <button
            className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            type="submit"
          >
            Сохранить
          </button>
        </form>
      </section>
    </div>
  );
}
