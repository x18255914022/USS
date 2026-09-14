import Link from "next/link";
import { apiFetchServer } from "../../../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

type GroupItem = { id: string; name: string };
type StreamGroupItem = { id: string; name: string };
type SubjectItem = { id: string; name: string; code: string };
type LessonTypeItem = { id: string; name: string; code: string };
type RoomItem = { id: string; name: string };
type TeacherItem = { id: string; user: { firstName: string; lastName: string; email: string } };

type LessonItem = {
  id: string;
  semesterId: string;
  dayOfWeek: number;
  timeslotId: string;
  subjectId: string;
  lessonTypeId: string;
  roomId: string | null;
  note: string | null;
  teachers: { teacherId: string }[];
  groups: { groupId: string }[];
  streamGroups: { streamGroupId: string }[];
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

export default async function ManagerLessonEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const lesson = await apiFetchServer<{ item: any }>(`/api/lessons/${encodeURIComponent(id)}`);
  const item = lesson.item as LessonItem;

  const [groups, streamGroups, subjects, lessonTypes, rooms, teachers, semesterDetails] = await Promise.all([
    apiFetchServer<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100"),
    apiFetchServer<PageResult<StreamGroupItem>>("/api/stream-groups?page=1&pageSize=100"),
    apiFetchServer<PageResult<SubjectItem>>("/api/subjects?page=1&pageSize=100"),
    apiFetchServer<PageResult<LessonTypeItem>>("/api/lesson-types?page=1&pageSize=100"),
    apiFetchServer<PageResult<RoomItem>>("/api/rooms?page=1&pageSize=100"),
    apiFetchServer<PageResult<TeacherItem>>("/api/teachers?page=1&pageSize=100"),
    apiFetchServer<{ item: { timeslotSets: { id: string; name: string; isDefault: boolean; timeslots: any[] }[] } }>(
      `/api/semesters/${encodeURIComponent(item.semesterId)}`
    )
  ]);

  const timeslots = semesterDetails.item.timeslotSets.flatMap((s) =>
    (s.timeslots ?? []).map((t: any) => ({
      id: String(t.id),
      label: `${s.name}${s.isDefault ? " (default)" : ""} — ${t.number}: ${t.startTime}-${t.endTime}`
    }))
  );

  const back = `/manager/lessons?semesterId=${encodeURIComponent(item.semesterId)}`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Редактировать занятие</h1>
          <p className="text-sm text-zinc-600">ID: {item.id}</p>
        </div>
        <Link className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50" href={back}>
          Назад
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <form action="/manager/lessons/action" method="post">
          <input type="hidden" name="actionType" value="update" />
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="semesterId" value={item.semesterId} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">День недели</span>
              <select
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="dayOfWeek"
                defaultValue={String(item.dayOfWeek)}
              >
                {Object.entries(DOW).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Таймслот</span>
              <select
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="timeslotId"
                defaultValue={item.timeslotId}
              >
                {timeslots.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Предмет</span>
              <select
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="subjectId"
                defaultValue={item.subjectId}
              >
                {subjects.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Тип</span>
              <select
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="lessonTypeId"
                defaultValue={item.lessonTypeId}
              >
                {lessonTypes.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Аудитория</span>
              <select
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="roomId"
                defaultValue={item.roomId ?? ""}
              >
                <option value="">—</option>
                {rooms.items.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Комментарий</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="note"
                defaultValue={item.note ?? ""}
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Преподаватели</span>
              <select
                className="h-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                name="teacherIds"
                multiple
                defaultValue={item.teachers.map((x) => x.teacherId)}
              >
                {teachers.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.lastName} {t.user.firstName} ({t.user.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Группы</span>
              <select
                className="h-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                name="groupIds"
                multiple
                defaultValue={item.groups.map((x) => x.groupId)}
              >
                {groups.items.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Потоки</span>
              <select
                className="h-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                name="streamGroupIds"
                multiple
                defaultValue={item.streamGroups.map((x) => x.streamGroupId)}
              >
                {streamGroups.items.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
            Сохранить
          </button>
        </form>
      </section>
    </div>
  );
}

