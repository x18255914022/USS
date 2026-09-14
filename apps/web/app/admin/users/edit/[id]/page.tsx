import Link from "next/link";
import { apiFetchServer } from "../../../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };
type GroupItem = { id: string; name: string };
type DepartmentItem = { id: string; code: string; name: string };

type UserItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: { role: { code: string } }[];
  student: { groupId: string } | null;
  teacher: { departmentId: string; position: string | null } | null;
};

export default async function UserEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const id = p.id;

  const groups = await apiFetchServer<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100");
  const departments = await apiFetchServer<PageResult<DepartmentItem>>("/api/departments?page=1&pageSize=100");
  const { item } = await apiFetchServer<{ item: UserItem }>(`/api/admin/users/${encodeURIComponent(id)}`);

  const role = item.roles[0]?.role.code ?? "student";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Пользователь: редактирование</h1>
          <div className="mt-1 text-sm text-zinc-600">ID: {id}</div>
        </div>
        <Link className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50" href="/admin/users">
          Назад
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <form className="grid grid-cols-1 gap-4 lg:max-w-2xl" action="/admin/users/action" method="post">
          <input type="hidden" name="actionType" value="update" />
          <input type="hidden" name="id" value={id} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Имя</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="firstName"
                defaultValue={item.firstName}
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Фамилия</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="lastName"
                defaultValue={item.lastName}
                required
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Email</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
              name="email"
              type="email"
              defaultValue={item.email}
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Новый пароль (опционально)</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
              name="password"
              type="password"
              minLength={8}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Роль</span>
            <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="roleCode" defaultValue={role}>
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <span className="text-sm font-medium text-zinc-800">Активен</span>
            <input type="checkbox" name="isActive" defaultChecked={item.isActive} className="h-4 w-4 accent-zinc-900" />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Группа (для student)</span>
              <select
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="groupId"
                defaultValue={item.student?.groupId ?? ""}
              >
                <option value="">—</option>
                {groups.items.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Кафедра (для teacher)</span>
              <select
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                name="departmentId"
                defaultValue={item.teacher?.departmentId ?? ""}
              >
                <option value="">—</option>
                {departments.items.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Должность (для teacher)</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
              name="position"
              defaultValue={item.teacher?.position ?? ""}
            />
          </label>

          <button className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
            Сохранить
          </button>
        </form>
      </section>
    </div>
  );
}

