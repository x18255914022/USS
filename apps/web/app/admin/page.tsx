import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Админ-панель</h1>
      <p className="mt-2 text-sm text-zinc-600">CRUD для справочников, защищено JWT + RBAC.</p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50" href="/admin/faculties">
          Факультеты
        </Link>
        <Link className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50" href="/admin/departments">
          Кафедры
        </Link>
        <Link className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50" href="/admin/buildings">
          Корпуса
        </Link>
        <Link className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50" href="/admin/rooms">
          Аудитории
        </Link>
        <Link className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50" href="/admin/groups">
          Группы
        </Link>
        <Link className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50" href="/admin/stream-groups">
          Потоки
        </Link>
        <Link className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50" href="/admin/users">
          Пользователи
        </Link>
        <Link className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50" href="/admin/semesters">
          Семестры
        </Link>
      </div>
    </div>
  );
}
