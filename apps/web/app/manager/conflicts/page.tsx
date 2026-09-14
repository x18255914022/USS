import Link from "next/link";
import { apiFetchServer } from "../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

type SemesterItem = { id: string; name: string; isActive: boolean };
type GroupItem = { id: string; name: string };
type ConflictItem = { entryId: string; withEntryId?: string; type: string; message: string };

function buildHref(base: string, params: Record<string, string | null | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v.length) usp.set(k, v);
  }
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function ManagerConflictsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const [semesters, groups] = await Promise.all([
    apiFetchServer<PageResult<SemesterItem>>("/api/semesters?page=1&pageSize=100"),
    apiFetchServer<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100")
  ]);

  const fromSemester = typeof sp.semesterId === "string" ? sp.semesterId : null;
  const fromGroup = typeof sp.groupId === "string" ? sp.groupId : null;
  const activeSemester = semesters.items.find((s) => s.isActive);
  const selectedSemesterId = fromSemester ?? activeSemester?.id ?? semesters.items[0]?.id ?? null;
  const selectedGroupId = fromGroup ?? groups.items[0]?.id ?? null;

  const conflicts = selectedSemesterId && selectedGroupId
    ? await apiFetchServer<{ items: ConflictItem[] }>(
        `/api/schedule/conflicts?semesterId=${encodeURIComponent(selectedSemesterId)}&groupId=${encodeURIComponent(
          selectedGroupId
        )}`
      )
    : { items: [] };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Конфликты</h1>
        <p className="text-sm text-zinc-600">Список конфликтов для выбранной группы и семестра.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-700">Семестр</span>
          <select
            className="h-11 w-80 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
            name="semesterId"
            defaultValue={selectedSemesterId ?? ""}
          >
            {semesters.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-700">Группа</span>
          <select
            className="h-11 w-64 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
            name="groupId"
            defaultValue={selectedGroupId ?? ""}
          >
            {groups.items.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <button className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
          Открыть
        </button>

        <Link
          className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
          href={buildHref("/manager/editor", { semesterId: selectedSemesterId, groupId: selectedGroupId, weekType: "BOTH" })}
        >
          В редактор
        </Link>
      </form>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Тип</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Описание</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Переход</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.items.length ? (
              conflicts.items.map((c, idx) => (
                <tr key={`${c.entryId}-${idx}`} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 align-top text-sm">{c.type}</td>
                  <td className="px-4 py-3 align-top text-sm">{c.message}</td>
                  <td className="px-4 py-3 align-top text-sm">
                    <Link
                      className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                      href={buildHref("/manager/editor", {
                        semesterId: selectedSemesterId ?? undefined,
                        groupId: selectedGroupId ?? undefined,
                        weekType: "BOTH",
                        entryId: c.entryId
                      })}
                    >
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-500" colSpan={3}>
                  Конфликтов не найдено ✅
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
