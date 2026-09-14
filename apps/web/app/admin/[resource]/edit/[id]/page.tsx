import Link from "next/link";
import { ADMIN_RESOURCES } from "../../../../../lib/adminResources";
import { apiFetchServer } from "../../../../../lib/serverApi";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };
type Option = { value: string; label: string };

export default async function AdminEditPage({
  params
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const p = await params;
  const resourceKey = p.resource;
  const id = p.id;

  const def = (ADMIN_RESOURCES as any)[resourceKey] as (typeof ADMIN_RESOURCES)[keyof typeof ADMIN_RESOURCES] | undefined;
  if (!def) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm text-zinc-600">Ресурс не найден: {resourceKey}</div>
      </div>
    );
  }

  const { item } = await apiFetchServer<{ item: any }>(`/api/${def.resource}/${encodeURIComponent(id)}`);

  const selectFields = def.fields.filter((f) => f.type === "select" && f.selectSource);
  const selectOptions = new Map<string, Option[]>();

  for (const f of selectFields) {
    const src = f.selectSource!;
    const r = await apiFetchServer<PageResult<any>>(`/api/${src.resource}?page=1&pageSize=100`);
    selectOptions.set(
      f.name,
      r.items.map((it) => ({ value: String(it.id), label: src.label(it) }))
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{def.title}: редактирование</h1>
          <div className="mt-1 text-sm text-zinc-600">ID: {id}</div>
        </div>
        <Link className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50" href={`/admin/${resourceKey}`}>
          Назад
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <form className="grid grid-cols-1 gap-4" action="/admin/action" method="post">
          <input type="hidden" name="actionType" value="update" />
          <input type="hidden" name="resource" value={resourceKey} />
          <input type="hidden" name="id" value={id} />

          {def.fields.map((f) => {
            if (f.type === "boolean") {
              return (
                <label
                  key={f.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-zinc-800">{f.label}</span>
                  <input type="checkbox" name={f.name} defaultChecked={!!item?.[f.name]} className="h-4 w-4 accent-zinc-900" />
                </label>
              );
            }

            if (f.type === "select") {
              const opts = selectOptions.get(f.name) ?? [];
              return (
                <label key={f.name} className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">{f.label}</span>
                  <select
                    className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                    name={f.name}
                    required={!!f.required}
                    defaultValue={String(item?.[f.name] ?? "")}
                  >
                    <option value="">—</option>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            if (f.type === "date") {
              // Format date from ISO to YYYY-MM-DD for date input
              const dateValue = item?.[f.name]
                ? new Date(item[f.name]).toISOString().split('T')[0]
                : "";
              return (
                <label key={f.name} className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">{f.label}</span>
                  <div className="relative">
                    <input
                      className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 pr-10 text-sm outline-none focus:border-zinc-400 cursor-pointer"
                      name={f.name}
                      type="date"
                      required={!!f.required}
                      defaultValue={dateValue}
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
              );
            }

            const type = f.type === "number" ? "number" : f.type === "color" ? "color" : "text";
            return (
              <label key={f.name} className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-700">{f.label}</span>
                <input
                  className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                  name={f.name}
                  type={type}
                  required={!!f.required}
                  defaultValue={item?.[f.name] != null ? String(item[f.name]) : ""}
                />
              </label>
            );
          })}

          <button
            className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            type="submit"
          >
            Сохранить
          </button>
        </form>
      </section>
    </div>
  );
}
