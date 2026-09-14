import Link from "next/link";
import { apiFetchServer } from "../../lib/serverApi";

type ChangeItem = {
  id: string;
  type: string;
  status: string;
  date: string;
  newDate?: string | null;
  reason?: string | null;
  lesson: { subject: { code: string }; timeslot: { number: number }; room: { name: string } | null } | null;
  newRoom?: { name: string } | null;
  newTimeslot?: { number: number } | null;
  newSubject?: { code: string } | null;
  targetGroup?: { name: string } | null;
  targetSubgroup?: { number: number; group: { name: string } } | null;
  targetStreamGroup?: { name: string } | null;
  createdBy: { email: string };
};

export default async function ChangesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const error = typeof sp.error === "string" ? sp.error : "";

  const me = await apiFetchServer<{ user: { roles: string[]; permissions: string[] } | null }>("/api/auth/me").catch(() => ({ user: null }));
  const canManage = !!me.user && (me.user.roles.includes("admin") || me.user.roles.includes("manager"));
  const canWrite = !!me.user && me.user.permissions.includes("changes:write");

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);

  const data = await apiFetchServer<{ items: ChangeItem[]; manager: boolean }>(`/api/changes?${qs.toString()}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Изменения расписания</h1>
        <p className="text-sm text-zinc-600">Запросы на отмену и замены.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error === "comment" ? "Укажите комментарий для отклонения." : "Не удалось выполнить действие. Попробуйте ещё раз."}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50" href="/changes">
          Все
        </Link>
        {["PENDING", "APPROVED", "REJECTED", "REVOKED"].map((s) => (
          <Link
            key={s}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
            href={`/changes?status=${encodeURIComponent(s)}`}
          >
            {s}
          </Link>
        ))}
        {canWrite ? (
          <Link className="ml-auto rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800" href="/changes/create">
            Создать
          </Link>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Статус</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Тип</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Дата</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Пара</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Автор</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">Действия</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length ? (
              data.items.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 align-top text-sm">{c.status}</td>
                  <td className="px-4 py-3 align-top text-sm">{c.type}</td>
                  <td className="px-4 py-3 align-top text-sm">{c.date.slice(0, 10)}</td>
                  <td className="px-4 py-3 align-top text-sm">
                    {c.type === "EXTRA" ? (
                      <>
                        №{c.newTimeslot?.number ?? "—"} · {c.newSubject?.code ?? "—"}
                        {c.targetGroup ? ` · ${c.targetGroup.name}` : ""}
                        {c.targetSubgroup ? ` · ${c.targetSubgroup.group.name}-${c.targetSubgroup.number}` : ""}
                        {c.targetStreamGroup ? ` · ${c.targetStreamGroup.name}` : ""}
                        {c.newRoom ? ` · ${c.newRoom.name}` : ""}
                      </>
                    ) : c.lesson ? (
                      <>
                        №{c.lesson.timeslot.number} · {c.lesson.subject.code}
                        {c.type === "REPLACE_ROOM" && c.newRoom ? ` · → ${c.newRoom.name}` : ""}
                        {c.type === "RESCHEDULE" && c.newDate ? ` · → ${c.newDate.slice(0, 10)}` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm">{c.createdBy.email}</td>
                  <td className="px-4 py-3 align-top text-sm">
                    <div className="flex flex-wrap gap-2">
                      {canManage && c.status === "PENDING" ? (
                        <>
                          <form action="/changes/action" method="post">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="actionType" value="approve" />
                            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500" type="submit">
                              Одобрить
                            </button>
                          </form>
                          <form action="/changes/action" method="post">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="actionType" value="reject" />
                            <input className="h-10 rounded-lg border border-zinc-200 px-3 text-sm" name="comment" placeholder="Комментарий" />
                            <button className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500" type="submit">
                              Отклонить
                            </button>
                          </form>
                        </>
                      ) : null}
                      {!canManage && c.status === "PENDING" ? (
                        <form action="/changes/action" method="post">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="actionType" value="revoke" />
                          <button className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50" type="submit">
                            Отозвать
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-500" colSpan={6}>
                  Нет запросов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
