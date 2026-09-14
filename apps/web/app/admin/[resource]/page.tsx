import Link from "next/link";
import { ADMIN_RESOURCES } from "../../../lib/adminResources";
import { apiFetchServer } from "../../../lib/serverApi";
import type { PageResult, AdminResourceItem, Option } from "../../../lib/types";

function parseNumber(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function AdminResourcePage({
  params,
  searchParams
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await params;
  const sp = await searchParams;

  const resourceKey = p.resource;
  const def = ADMIN_RESOURCES[resourceKey];

  if (!def) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm text-zinc-600">Ресурс не найден: {resourceKey}</div>
      </div>
    );
  }

  const page = Math.max(1, parseNumber(typeof sp.page === "string" ? sp.page : null) ?? 1);
  const pageSize = Math.max(1, Math.min(200, parseNumber(typeof sp.pageSize === "string" ? sp.pageSize : null) ?? 20));
  const q = typeof sp.q === "string" ? sp.q : "";

  let list: PageResult<AdminResourceItem>;
  let selectOptions = new Map<string, Option[]>();
  let error: string | null = null;

  try {
    list = await apiFetchServer<PageResult<AdminResourceItem>>(
      `/api/${def.resource}?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}${
        q ? `&q=${encodeURIComponent(q)}` : ""
      }`
    );

    const selectFields = def.fields.filter((f) => f.type === "select" && f.selectSource);

    for (const f of selectFields) {
      const src = f.selectSource;
      if (!src) continue;
      
      try {
        const r = await apiFetchServer<PageResult<AdminResourceItem>>(`/api/${src.resource}?page=1&pageSize=100`);
        selectOptions.set(
          f.name,
          r.items.map((it) => ({ value: String(it.id), label: src.label(it) }))
        );
      } catch (e) {
        console.error(`Failed to load select options for ${f.name}:`, e);
      }
    }
  } catch (e) {
    console.error("Failed to load resource:", e);
    error = "Не удалось загрузить данные. Пожалуйста, попробуйте позже.";
    list = { items: [], total: 0, page: 1, pageSize: 20 };
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{def.title}</h1>
        <div className="text-sm text-zinc-600">API: /api/{def.resource}</div>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-col gap-2 text-sm">
          <label htmlFor="search-q" className="text-zinc-700">Поиск</label>
          <input
            id="search-q"
            className="h-11 w-64 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
            name="q"
            defaultValue={q}
            placeholder="Введите поисковый запрос"
          />
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <label htmlFor="page-num" className="text-zinc-700">Страница</label>
          <input
            id="page-num"
            className="h-11 w-28 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
            name="page"
            type="number"
            min={1}
            defaultValue={page}
          />
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <label htmlFor="page-size" className="text-zinc-700">На странице</label>
          <input
            id="page-size"
            className="h-11 w-28 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
            name="pageSize"
            type="number"
            min={1}
            max={200}
            defaultValue={pageSize}
          />
        </div>

        <button
          className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          type="submit"
        >
          Обновить
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white">
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                {def.listColumns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={String(item.id)} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700">{String(item.id)}</td>
                  {def.listColumns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-zinc-800">
                      {String(item?.[c.key] ?? "")}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50 inline-flex items-center"
                        href={`/admin/${resourceKey}/edit/${String(item.id)}`}
                      >
                        Редактировать
                      </Link>
                      <form action="/admin/action" method="post">
                        <input type="hidden" name="actionType" value="delete" />
                        <input type="hidden" name="resource" value={resourceKey} />
                        <input type="hidden" name="id" value={String(item.id)} />
                        <button
                          className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium hover:bg-zinc-50"
                          type="submit"
                        >
                          Удалить
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {list.items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={def.listColumns.length + 2}>
                    Пусто
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-600">Total: {list.total}</div>
      </div>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold tracking-tight">Создать</h2>

        <form className="mt-4 grid grid-cols-1 gap-4 lg:max-w-xl" action="/admin/action" method="post">
          <input type="hidden" name="actionType" value="create" />
          <input type="hidden" name="resource" value={resourceKey} />

          {def.fields.map((f) => {
            const fieldId = `field-${f.name}`;
            
            if (f.type === "boolean") {
              const defaultChecked = f.name === "isActive";
              return (
                <div
                  key={f.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                >
                  <label htmlFor={fieldId} className="text-sm font-medium text-zinc-800">{f.label}</label>
                  <input id={fieldId} type="checkbox" name={f.name} defaultChecked={defaultChecked} className="h-4 w-4 accent-zinc-900" />
                </div>
              );
            }

            if (f.type === "select") {
              const opts = selectOptions.get(f.name) ?? [];
              return (
                <div key={f.name} className="flex flex-col gap-2 text-sm">
                  <label htmlFor={fieldId} className="text-zinc-700">{f.label}</label>
                  <select
                    id={fieldId}
                    className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                    name={f.name}
                    required={!!f.required}
                    defaultValue=""
                  >
                    <option value="">—</option>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (f.type === "date") {
              return (
                <div key={f.name} className="flex flex-col gap-2 text-sm">
                  <label htmlFor={fieldId} className="text-zinc-700">{f.label}</label>
                  <div className="relative">
                    <input
                      id={fieldId}
                      className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 pr-10 text-sm outline-none focus:border-zinc-400 cursor-pointer"
                      name={f.name}
                      type="date"
                      required={!!f.required}
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
                </div>
              );
            }

            const type = f.type === "number" ? "number" : f.type === "color" ? "color" : "text";
            return (
              <div key={f.name} className="flex flex-col gap-2 text-sm">
                <label htmlFor={fieldId} className="text-zinc-700">{f.label}</label>
                <input
                  id={fieldId}
                  className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                  name={f.name}
                  type={type}
                  required={!!f.required}
                />
              </div>
            );
          })}

          <button
            className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            type="submit"
          >
            Создать
          </button>
        </form>
      </section>
    </div>
  );
}
