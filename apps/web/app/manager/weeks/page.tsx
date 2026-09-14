import { apiFetchServer } from "../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

type SemesterItem = { id: string; name: string; isActive: boolean };
type WeekItem = { id: string; weekNumber: number; startDate: string; weekType: string; isActive: boolean };

export default async function ManagerWeeksPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const semesters = await apiFetchServer<PageResult<SemesterItem>>("/api/semesters?page=1&pageSize=100");

  const fromQuery = typeof sp.semesterId === "string" ? sp.semesterId : null;
  const active = semesters.items.find((s) => s.isActive);
  const selectedSemesterId = fromQuery ?? active?.id ?? semesters.items[0]?.id ?? null;

  const weeks = selectedSemesterId
    ? await apiFetchServer<{ weeks: WeekItem[] }>(`/api/semesters/${encodeURIComponent(selectedSemesterId)}/weeks`)
    : { weeks: [] };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Недели семестра</h1>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
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

        <button className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
          Открыть
        </button>
      </form>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold tracking-tight">Разметка</h2>

        <form className="mt-4" action="/manager/weeks/action" method="post">
          <input type="hidden" name="semesterId" value={selectedSemesterId ?? ""} />

          <div className="overflow-auto rounded-xl border border-zinc-200">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Неделя</th>
                  <th className="px-4 py-3 font-medium">Старт</th>
                  <th className="px-4 py-3 font-medium">Тип</th>
                  <th className="px-4 py-3 font-medium">Активна</th>
                </tr>
              </thead>
              <tbody>
                {weeks.weeks.map((w) => (
                  <tr key={w.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{w.weekNumber}</td>
                    <td className="px-4 py-3 text-zinc-700">{String(w.startDate).slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <input type="hidden" name="weekId" value={w.id} />
                      <select
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-zinc-400"
                        name={`weekType_${w.id}`}
                        defaultValue={w.weekType}
                      >
                        <option value="UPPER">UPPER</option>
                        <option value="LOWER">LOWER</option>
                        <option value="EVERY">EVERY</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        name={`isActive_${w.id}`}
                        defaultChecked={!!w.isActive}
                        className="h-4 w-4 accent-zinc-900"
                      />
                    </td>
                  </tr>
                ))}
                {weeks.weeks.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-zinc-600" colSpan={4}>
                      Выберите семестр
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <button
            className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            type="submit"
            disabled={!selectedSemesterId}
          >
            Сохранить
          </button>
        </form>
      </section>
    </div>
  );
}

