import Link from "next/link";
import { apiFetchServer } from "../../lib/serverApi";
import type { ScheduleData, ScheduleItem } from "../../lib/types";

function fmtDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_LABELS: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс"
};

export default async function SchedulePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const date = typeof sp.date === "string" ? sp.date : fmtDateInput(new Date());

  let data: ScheduleData;
  let error: string | null = null;

  try {
    data = await apiFetchServer<ScheduleData>(
      `/api/schedule/me?date=${encodeURIComponent(date)}`
    );
  } catch (e) {
    console.error("Failed to load schedule:", e);
    error = "Не удалось загрузить расписание. Пожалуйста, попробуйте позже.";
    data = {
      kind: "none",
      weekType: null,
      week: null,
      timeslots: [],
      items: []
    };
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      </div>
    );
  }

  const days = [1, 2, 3, 4, 5, 6];
  const timeslots = data.timeslots?.length
    ? data.timeslots
    : Array.from(
        new Map(data.items.map((x) => [x.timeslot.id, x.timeslot] as const)).values()
      ).sort((a, b) => a.number - b.number);

  const itemsByCell = new Map<string, ScheduleItem[]>();
  for (const it of data.items) {
    const key = `${it.dayOfWeek}:${it.timeslotId}`;
    const arr = itemsByCell.get(key) ?? [];
    arr.push(it);
    itemsByCell.set(key, arr);
  }

  const emptyState =
    data.kind === "none"
      ? {
          title: "Расписание недоступно",
          text: "Профиль не привязан к группе или преподавателю."
        }
      : data.items.length === 0
        ? {
            title: "Нет занятий",
            text: "На выбранную неделю занятий нет."
          }
        : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-500">
            {data.week ? `Неделя ${data.week.weekNumber} (${data.weekType ?? "—"})` : "Неделя —"}
          </div>
          <div className="text-lg font-semibold">Моё расписание</div>
        </div>

        <form method="get" className="flex items-center gap-2" aria-label="Форма выбора даты">
          <div className="relative">
            <label htmlFor="schedule-date" className="sr-only">Выберите дату</label>
            <input 
              id="schedule-date"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-zinc-400 cursor-pointer" 
              type="date" 
              name="date" 
              defaultValue={date}
              aria-label="Дата расписания"
            />
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <button className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
            Показать
          </button>
          <Link className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50" href="/schedule">
            Сегодня
          </Link>
        </form>
      </div>

      {emptyState ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="text-sm font-medium text-zinc-800">{emptyState.title}</div>
          <div className="mt-1 text-sm text-zinc-600">{emptyState.text}</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="w-40 px-4 py-3 text-left text-xs font-semibold text-zinc-600">Пара</th>
                {days.map((d) => (
                  <th key={d} className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">
                    {DAY_LABELS[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeslots.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 align-top text-sm">
                    <div className="font-medium">№{t.number}</div>
                    <div className="text-xs text-zinc-500">
                      {t.startTime}–{t.endTime}
                    </div>
                  </td>
                  {days.map((d) => {
                    const key = `${d}:${t.id}`;
                    const cell = itemsByCell.get(key) ?? [];
                    return (
                      <td key={key} className="px-4 py-3 align-top">
                        {cell.length ? (
                          <div className="space-y-2">
                            {cell.map((it) => {
                              const teacher = it.teachers[0]?.teacher.user;
                              return (
                                <div
                                  key={it.id}
                                  className={[
                                    "rounded-lg border border-zinc-200 px-3 py-2 text-sm",
                                    it.cancelled ? "opacity-70" : ""
                                  ].join(" ")}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className={["font-semibold", it.cancelled ? "line-through" : ""].join(" ")}>
                                      {it.subject.code} <span className="font-normal text-zinc-600">{it.subject.name}</span>
                                    </div>
                                    {it.cancelled ? (
                                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                        Отмена
                                      </span>
                                    ) : it.isExtra ? (
                                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                        Доп.
                                      </span>
                                    ) : it.rescheduledTo ? (
                                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                        Перенос
                                      </span>
                                    ) : (
                                      <span
                                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                                        style={{ backgroundColor: `${it.lessonType.color}22`, color: it.lessonType.color }}
                                      >
                                        {it.lessonType.name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs text-zinc-600">
                                    {teacher ? `${teacher.lastName} ${teacher.firstName}` : "—"}
                                    {it.room ? ` · ${it.room.name}` : ""}
                                    {it.roomOverride ? ` · 🔄 ${it.roomOverride.name}` : ""}
                                    {it.rescheduledTo ? ` · Перенесено на ${it.rescheduledTo}` : ""}
                                    {it.movedFrom ? ` · Перенос с ${it.movedFrom}` : ""}
                                    {it.weekType !== "EVERY" ? ` · ${it.weekType}` : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-400">—</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
