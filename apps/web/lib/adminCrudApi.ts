import { apiFetch } from "./apiFetch";

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export async function listResource<T>(resource: string, params: { page?: number; pageSize?: number; q?: string }) {
  const u = new URLSearchParams();
  u.set("page", String(params.page ?? 1));
  u.set("pageSize", String(params.pageSize ?? 20));
  if (params.q) u.set("q", params.q);

  return apiFetch<PageResult<T>>(`/api/${resource}?${u.toString()}`);
}

export async function createResource<T>(resource: string, data: Record<string, unknown>) {
  return apiFetch<{ item: T }>(`/api/${resource}`, { method: "POST", body: JSON.stringify(data) });
}

export async function updateResource<T>(resource: string, id: string, data: Record<string, unknown>) {
  return apiFetch<{ item: T }>(`/api/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteResource(resource: string, id: string) {
  return apiFetch<unknown>(`/api/${resource}/${id}`, { method: "DELETE" });
}

