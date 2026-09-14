import { apiFetchServer } from "../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

type SemesterItem = { id: string; name: string; isActive: boolean };
type SystemSettings = { minCancelHours: number; autoApproveReplaceRoom: boolean };
type SemesterSettings = { minCancelHours: number | null; autoApproveReplaceRoom: boolean | null } | null;

export default async function ManagerSettingsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const semesters = await apiFetchServer<PageResult<SemesterItem>>("/api/semesters?page=1&pageSize=100");

  const fromQuery = typeof sp.semesterId === "string" ? sp.semesterId : null;
  const active = semesters.items.find((s) => s.isActive);
  const selectedSemesterId = fromQuery ?? active?.id ?? semesters.items[0]?.id ?? null;

  const data = selectedSemesterId
    ? await apiFetchServer<{
        semester: SemesterItem;
        global: SystemSettings;
        overrides: SemesterSettings;
        effective: SystemSettings;
      }>(`/api/semesters/${encodeURIComponent(selectedSemesterId)}/settings`)
    : null;

  const overrides = data?.overrides ?? null;
  const global = data?.global ?? { minCancelHours: 2, autoApproveReplaceRoom: true };
  const effective = data?.effective ?? global;
  const hasOverrides = !!overrides && (overrides.minCancelHours !== null || overrides.autoApproveReplaceRoom !== null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки семестра</h1>
        <p className="text-sm text-zinc-600">Переопределения действуют только для выбранного семестра.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-700">Семестр</span>
          <select
            className="h-11 w-96 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
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

      {data ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-1">
            <div className="text-sm text-zinc-500">Эффективные значения</div>
            <div className="text-sm">
              minCancelHours: <span className="font-semibold">{effective.minCancelHours}</span> · autoApproveReplaceRoom:{" "}
              <span className="font-semibold">{String(effective.autoApproveReplaceRoom)}</span>
            </div>
          </div>

          <form className="mt-6 grid gap-6" action="/manager/settings/action" method="post">
            <input type="hidden" name="semesterId" value={selectedSemesterId ?? ""} />

            <div className="grid gap-2">
              <div className="text-sm font-medium text-zinc-700">Минимальные часы для отмены</div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  name="minCancelHoursMode"
                  defaultValue={overrides?.minCancelHours === null || overrides?.minCancelHours === undefined ? "default" : "custom"}
                >
                  <option value="default">По умолчанию: {global.minCancelHours}</option>
                  <option value="custom">Переопределить</option>
                </select>
                <input
                  className="h-11 w-32 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                  type="number"
                  name="minCancelHours"
                  min={0}
                  defaultValue={typeof overrides?.minCancelHours === "number" ? String(overrides.minCancelHours) : ""}
                  placeholder={`По умолчанию: ${global.minCancelHours}`}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium text-zinc-700">Авто-апрув замены аудитории</div>
              <select
                className="h-11 w-96 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                name="autoApproveReplaceRoomMode"
                defaultValue={
                  overrides?.autoApproveReplaceRoom === null || overrides?.autoApproveReplaceRoom === undefined
                    ? "default"
                    : overrides.autoApproveReplaceRoom
                      ? "true"
                      : "false"
                }
              >
                <option value="default">По умолчанию: {String(global.autoApproveReplaceRoom)}</option>
                <option value="true">Включено</option>
                <option value="false">Выключено</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                type="submit"
                name="intent"
                value="save"
              >
                Сохранить
              </button>
              {hasOverrides ? (
                <button
                  className="inline-flex h-11 w-fit items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50"
                  type="submit"
                  name="intent"
                  value="reset"
                >
                  Сбросить переопределения
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Выберите семестр</div>
      )}
    </div>
  );
}
