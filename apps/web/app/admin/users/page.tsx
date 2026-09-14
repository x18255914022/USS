import Link from "next/link";
import { apiFetchServer } from "../../../lib/serverApi";

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
  student: { group: { name: string } } | null;
  teacher: { department: { code: string } } | null;
};

export default async function UsersPage() {
  const users = await apiFetchServer<PageResult<UserItem>>("/api/admin/users?page=1&pageSize=100");
  const groups = await apiFetchServer<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100");
  const departments = await apiFetchServer<PageResult<DepartmentItem>>("/api/departments?page=1&pageSize=100");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Пользователи</h1>
        <div className="text-sm text-zinc-600">API: /api/admin/users</div>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold tracking-tight">Создать</h2>

        <form className="mt-4 grid grid-cols-1 gap-4 lg:max-w-2xl" action="/admin/users/action" method="post">
          <input type="hidden" name="actionType" value="create" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Имя</span>
              <input className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="firstName" required />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Фамилия</span>
              <input className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="lastName" required />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Email</span>
            <input className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="email" type="email" required />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Пароль</span>
            <input className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="password" type="password" minLength={8} required />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Роль</span>
            <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="roleCode" defaultValue="student">
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <span className="text-sm font-medium text-zinc-800">Активен</span>
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-zinc-900" />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Группа (для student)</span>
              <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="groupId" defaultValue="">
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
              <select className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="departmentId" defaultValue="">
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
            <input className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400" name="position" />
          </label>

          <button className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800" type="submit">
            Создать
          </button>
        </form>
      </section>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">Роли</th>
                <th className="px-4 py-3 font-medium">Профиль</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.items.map((u) => {
                const roles = u.roles.map((r) => r.role.code).join(", ");
                const profile = u.student ? `student: ${u.student.group.name}` : u.teacher ? `teacher: ${u.teacher.department.code}` : "—";
                return (
                  <tr key={u.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">{u.email}</td>
                    <td className="px-4 py-3 text-zinc-800">
                      {u.firstName} {u.lastName} {u.isActive ? "" : "(inactive)"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{roles}</td>
                    <td className="px-4 py-3 text-zinc-700">{profile}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 inline-flex items-center"
                        href={`/admin/users/edit/${u.id}`}
                      >
                        Редактировать
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {users.items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={5}>
                    Пусто
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600">Total: {users.total}</div>
      </div>
    </div>
  );
}

