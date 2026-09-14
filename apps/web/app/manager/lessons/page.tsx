import Link from "next/link";
import { apiFetchServer } from "../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

type SemesterItem = { id: string; name: string; isActive: boolean };
type GroupItem = { id: string; name: string };
type StreamGroupItem = { id: string; name: string };
type SubjectItem = { id: string; name: string; code: string };
type LessonTypeItem = { id: string; name: string; code: string; color: string };
type RoomItem = { id: string; name: string };
type TeacherItem = { id: string; user: { firstName: string; lastName: string; email: string } };

type LessonItem = {
  id: string;
  semesterId: string;
  academicWeekId: string | null;
  dayOfWeek: number;
  note: string | null;
  timeslot: { id: string; number: number; startTime: string; endTime: string; timeslotSet: { name: string; isDefault: boolean } };
  subject: { id: string; name: string; code: string };
  lessonType: { id: string; name: string; code: string; color: string };
  room: { id: string; name: string } | null;
  teachers: { teacher: { id: string; user: { firstName: string; lastName: string } } }[];
  groups: { group: { id: string; name: string } }[];
  streamGroups: { streamGroup: { id: string; name: string } }[];
};

const DOW: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс"
};

export default async function ManagerLessonsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const semesters = await apiFetchServer<PageResult<SemesterItem>>("/api/semesters?page=1&pageSize=100");
  const fromQuery = typeof sp.semesterId === "string" ? sp.semesterId : null;
  const active = semesters.items.find((s) => s.isActive);
  const selectedSemesterId = fromQuery ?? active?.id ?? semesters.items[0]?.id ?? null;

  const [lessons, groups, streamGroups, subjects, lessonTypes, rooms, teachers, semesterDetails] = await Promise.all([
    selectedSemesterId
      ? apiFetchServer<PageResult<LessonItem>>(
          `/api/lessons?semesterId=${encodeURIComponent(selectedSemesterId)}&page=1&pageSize=100`
        )
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
    apiFetchServer<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100"),
    apiFetchServer<PageResult<StreamGroupItem>>("/api/stream-groups?page=1&pageSize=100"),
    apiFetchServer<PageResult<SubjectItem>>("/api/subjects?page=1&pageSize=100"),
    apiFetchServer<PageResult<LessonTypeItem>>("/api/lesson-types?page=1&pageSize=100"),
    apiFetchServer<PageResult<RoomItem>>("/api/rooms?page=1&pageSize=100"),
    apiFetchServer<PageResult<TeacherItem>>("/api/teachers?page=1&pageSize=100"),
    selectedSemesterId
      ? apiFetchServer<{ item: { timeslotSets: { id: string; name: string; isDefault: boolean; timeslots: any[] }[] } }>(
          `/api/semesters/${encodeURIComponent(selectedSemesterId)}`
        )
      : Promise.resolve({ item: { timeslotSets: [] } })
  ]);

  const timeslots = semesterDetails.item.timeslotSets.flatMap((s) =>
    (s.timeslots ?? []).map((t: any) => ({
      id: String(t.id),
      label: `${s.name}${s.isDefault ? " (default)" : ""} — ${t.number}: ${t.startTime}-${t.endTime}`
    }))
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Занятия</h1>
        <p className="text-sm text-zinc-600">Создание и просмотр занятий в выбранном семестре.</p>
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
        <h2 className="text-lg font-semibold tracking-tight">Создать занятие</h2>

        <form className="mt-4" action="/manager/lessons/action" method="post">
          <input type="hidden" name="actionType" value="create" />
          <input type="hidden" name="semesterId" value={selectedSemesterId ?? ""} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">День недели</span>
              <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="dayOfWeek" defaultValue="1">
                {Object.entries(DOW).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Таймслот</span>
              <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="timeslotId" defaultValue="">
                <option value="" disabled>
                  Выберите таймслот
                </option>
                {timeslots.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Предмет</span>
              <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="subjectId" defaultValue="">
                <option value="" disabled>
                  Выберите предмет
                </option>
                {subjects.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Тип</span>
              <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="lessonTypeId" defaultValue="">
                <option value="" disabled>
                  Выберите тип
                </option>
                {lessonTypes.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Аудитория (опционально)</span>
              <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="roomId" defaultValue="">
                <option value="">—</option>
                {rooms.items.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Комментарий (опционально)</span>
              <input className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="note" />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Преподаватели</span>
              <select className="h-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" name="teacherIds" multiple>
                {teachers.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.lastName} {t.user.firstName} ({t.user.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Группы</span>
              <select className="h-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" name="groupIds" multiple>
                {groups.items.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Потоки</span>
              <select className="h-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" name="streamGroupIds" multiple>
                {streamGroups.items.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            type="submit"
            disabled={!selectedSemesterId}
          >
            Создать
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold tracking-tight">Список</h2>

        <div className="mt-4 overflow-auto rounded-xl border border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">День</th>
                <th className="px-4 py-3 font-medium">Время</th>
                <th className="px-4 py-3 font-medium">Предмет</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Кому</th>
                <th className="px-4 py-3 font-medium">Преподаватели</th>
                <th className="px-4 py-3 font-medium">Ауд.</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {lessons.items.map((l) => {
                const groupsLabel = [
                  ...l.groups.map((x) => x.group.name),
                  ...l.streamGroups.map((x) => `Поток: ${x.streamGroup.name}`)
                ].join(", ");
                const teachersLabel = l.teachers.map((x) => `${x.teacher.user.lastName} ${x.teacher.user.firstName}`).join(", ");
                return (
                  <tr key={l.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{DOW[l.dayOfWeek] ?? String(l.dayOfWeek)}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      #{l.timeslot.number} {l.timeslot.startTime}-{l.timeslot.endTime}
                    </td>
                    <td className="px-4 py-3">{l.subject.code}</td>
                    <td className="px-4 py-3">{l.lessonType.name}</td>
                    <td className="px-4 py-3">{groupsLabel || "—"}</td>
                    <td className="px-4 py-3">{teachersLabel || "—"}</td>
                    <td className="px-4 py-3">{l.room?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link className="text-sm font-medium text-zinc-900 hover:underline" href={`/manager/lessons/edit/${l.id}`}>
                          Edit
                        </Link>
                        <form action="/manager/lessons/action" method="post">
                          <input type="hidden" name="actionType" value="delete" />
                          <input type="hidden" name="id" value={l.id} />
                          <input type="hidden" name="semesterId" value={selectedSemesterId ?? ""} />
                          <button className="text-sm font-medium text-red-700 hover:underline" type="submit">
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {lessons.items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={8}>
                    Нет занятий
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

