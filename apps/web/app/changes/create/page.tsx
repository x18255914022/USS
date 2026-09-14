import { apiFetchServer } from "../../../lib/serverApi";

type ScheduleItem = { id: string; dayOfWeek: number; timeslot: { number: number }; subject: { code: string } };
type Timeslot = { id: string; number: number };
type RoomItem = { id: string; name: string };
type TeacherItem = { id: string; user: { firstName: string; lastName: string } };
type SubjectItem = { id: string; code: string; name: string };
type LessonTypeItem = { id: string; name: string };
type SemesterItem = { id: string; name: string; isActive: boolean };
type GroupItem = { id: string; name: string; subgroups?: { id: string; number: number }[] };
type StreamGroupItem = { id: string; name: string };
type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };

function fmtDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function ChangeCreatePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const type = typeof sp.type === "string" ? sp.type : "CANCEL";
  const date = typeof sp.date === "string" ? sp.date : fmtDateInput(new Date());
  const error = typeof sp.error === "string" ? sp.error : "";

  const sched = await apiFetchServer<{ items: ScheduleItem[]; timeslots: Timeslot[]; semester?: { id: string } | null; weekType?: string | null }>(
    `/api/schedule/me?date=${encodeURIComponent(date)}`
  );
  const d = new Date(date);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  const dayItems = (sched.items ?? []).filter((x) => x.dayOfWeek === dow);
  let timeslots: Timeslot[] = (sched as any).timeslots ?? [];

  const rooms =
    type === "REPLACE_ROOM" || type === "RESCHEDULE" || type === "EXTRA"
      ? await apiFetchServer<PageResult<RoomItem>>("/api/rooms?page=1&pageSize=100").then((r) => r.items)
      : [];

  const teachers =
    type === "RESCHEDULE" || type === "EXTRA"
      ? await apiFetchServer<PageResult<TeacherItem>>("/api/teachers?page=1&pageSize=100").then((r) => r.items)
      : [];

  const semesters =
    type === "EXTRA" ? await apiFetchServer<PageResult<SemesterItem>>("/api/semesters?page=1&pageSize=100").then((r) => r.items) : [];
  const activeSemesterId = semesters.find((s) => s.isActive)?.id ?? semesters[0]?.id ?? null;
  const semesterId = type === "EXTRA" ? (typeof sp.semesterId === "string" ? sp.semesterId : activeSemesterId) : null;

  if (type === "EXTRA" && semesterId) {
    const sem = await apiFetchServer<{ item: { timeslotSets: { isDefault: boolean; timeslots: Timeslot[] }[] } }>(
      `/api/semesters/${encodeURIComponent(semesterId)}`
    );
    const set = sem.item.timeslotSets.find((s) => s.isDefault) ?? sem.item.timeslotSets[0];
    if (set?.timeslots?.length) timeslots = set.timeslots.map((t) => ({ id: t.id, number: t.number }));
  }

  const subjects = type === "EXTRA" ? await apiFetchServer<PageResult<SubjectItem>>("/api/subjects?page=1&pageSize=100").then((r) => r.items) : [];
  const lessonTypes =
    type === "EXTRA" ? await apiFetchServer<PageResult<LessonTypeItem>>("/api/lesson-types?page=1&pageSize=100").then((r) => r.items) : [];
  const groups = type === "EXTRA" ? await apiFetchServer<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100").then((r) => r.items) : [];
  const streamGroups =
    type === "EXTRA" ? await apiFetchServer<PageResult<StreamGroupItem>>("/api/stream-groups?page=1&pageSize=100").then((r) => r.items) : [];

  const audienceKind = type === "EXTRA" && typeof sp.audienceKind === "string" ? sp.audienceKind : "group";
  const selectedGroupId = type === "EXTRA" && typeof sp.groupId === "string" ? sp.groupId : groups[0]?.id ?? "";
  const selectedGroup =
    type === "EXTRA" && selectedGroupId ? await apiFetchServer<{ item: GroupItem }>(`/api/groups/${encodeURIComponent(selectedGroupId)}`).then((x) => x.item) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Создать запрос</h1>
        <p className="text-sm text-zinc-600">Отмена, перенос и доп. занятия.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error === "deadline"
            ? "Слишком поздно для отмены: превышен минимальный дедлайн."
            : "Не удалось создать запрос. Проверьте поля и попробуйте ещё раз."}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {["CANCEL", "REPLACE_ROOM", "RESCHEDULE", "EXTRA"].map((t) => (
          <a
            key={t}
            className={[
              "rounded-lg border px-3 py-2 text-sm font-medium",
              t === type ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
            ].join(" ")}
            href={`/changes/create?type=${encodeURIComponent(t)}&date=${encodeURIComponent(date)}`}
          >
            {t}
          </a>
        ))}
      </div>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input type="hidden" name="type" value={type} />
        <div className="relative">
          <input 
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-zinc-400 cursor-pointer" 
            type="date" 
            name="date" 
            defaultValue={date} 
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
      </form>

      {type === "CANCEL" || type === "REPLACE_ROOM" || type === "RESCHEDULE" ? (
        dayItems.length ? (
          <form className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6" action="/changes/create/action" method="post">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="type" value={type} />

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Пара</span>
              <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="lessonId" required defaultValue="">
                <option value="" disabled>
                  Выберите
                </option>
                {dayItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    №{it.timeslot.number} · {it.subject.code}
                  </option>
                ))}
              </select>
            </label>

            {type === "REPLACE_ROOM" ? (
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-700">Новая аудитория</span>
                <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="newRoomId" required defaultValue="">
                  <option value="" disabled>
                    Выберите
                  </option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {type === "RESCHEDULE" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Новая дата</span>
                  <div className="relative">
                    <input 
                      className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 pr-10 text-sm outline-none focus:border-zinc-400 cursor-pointer" 
                      type="date" 
                      name="newDate" 
                      required 
                      defaultValue={date} 
                    />
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Новый слот</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="newTimeslotId" defaultValue="">
                    <option value="">Без изменений</option>
                    {timeslots.map((t) => (
                      <option key={t.id} value={t.id}>
                        №{t.number}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Новая аудитория</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="newRoomId" defaultValue="">
                    <option value="">Без изменений</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Новый преподаватель</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="newTeacherId" defaultValue="">
                    <option value="">Без изменений</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.user.lastName} {t.user.firstName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Причина</span>
              <textarea className="min-h-[96px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" name="reason" />
            </label>

            <button className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
              Отправить
            </button>
          </form>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Нет занятий на выбранную дату — нечего отменять или переносить.
          </div>
        )
      ) : null}

      {type === "EXTRA" ? (
        semesterId ? (
          <>
            <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4" method="get">
              <input type="hidden" name="type" value="EXTRA" />
              <input type="hidden" name="date" value={date} />
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-700">Семестр</span>
                <select className="h-11 w-96 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="semesterId" defaultValue={semesterId ?? ""}>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isActive ? " (active)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-700">Аудитория</span>
                <select className="h-11 w-60 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="audienceKind" defaultValue={audienceKind}>
                  <option value="group">Группа</option>
                  <option value="subgroup">Подгруппа</option>
                  <option value="stream">Поток</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-700">Группа</span>
                <select className="h-11 w-60 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="groupId" defaultValue={selectedGroupId}>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
                Применить
              </button>
            </form>

            <form className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6" action="/changes/create/action" method="post">
              <input type="hidden" name="type" value="EXTRA" />
              <input type="hidden" name="semesterId" value={semesterId ?? ""} />

              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-700">Дата</span>
                <div className="relative">
                  <input 
                    className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 pr-10 text-sm outline-none focus:border-zinc-400 cursor-pointer" 
                    type="date" 
                    name="date" 
                    required 
                    defaultValue={date} 
                  />
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Слот</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="timeslotId" required defaultValue="">
                    <option value="" disabled>
                      Выберите
                    </option>
                    {timeslots.map((t) => (
                      <option key={t.id} value={t.id}>
                        №{t.number}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Предмет</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="subjectId" required defaultValue="">
                    <option value="" disabled>
                      Выберите
                    </option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Тип занятия</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="lessonTypeId" required defaultValue="">
                    <option value="" disabled>
                      Выберите
                    </option>
                    {lessonTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Преподаватель</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="teacherId" required defaultValue="">
                    <option value="" disabled>
                      Выберите
                    </option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.user.lastName} {t.user.firstName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Аудитория</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="roomId" required defaultValue="">
                    <option value="" disabled>
                      Выберите
                    </option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {audienceKind === "stream" ? (
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Поток</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="streamGroupId" required defaultValue="">
                    <option value="" disabled>
                      Выберите
                    </option>
                    {streamGroups.map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : audienceKind === "subgroup" ? (
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Подгруппа</span>
                  <input type="hidden" name="groupId" value={selectedGroupId} />
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="subgroupId" required defaultValue="">
                    <option value="" disabled>
                      Выберите
                    </option>
                    {(selectedGroup?.subgroups ?? []).map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {selectedGroup?.name}-{sg.number}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Группа</span>
                  <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="groupId" required defaultValue={selectedGroupId}>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-700">Причина</span>
                <textarea className="min-h-[96px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400" name="reason" />
              </label>

              <button className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
                Отправить
              </button>
            </form>
          </>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Нет доступных семестров для создания доп. занятия.</div>
        )
      ) : null}
    </div>
  );
}
