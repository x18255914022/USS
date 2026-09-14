import { env } from "./env.js";

type ApiInit = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

export async function apiFetch<T>(path: string, init: ApiInit = {}) {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  headers["x-bot-token"] = env.BOT_TOKEN;
  if (init.body && !headers["content-type"]) headers["content-type"] = "application/json";

  const res = await fetch(`${env.API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP_${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function requestLinkCode(chatId: string) {
  return apiFetch<{ code: string; expiresAt: string }>("/api/telegram/link/request", {
    method: "POST",
    body: JSON.stringify({ telegramChatId: chatId })
  });
}

export async function searchGroups(q: string) {
  const qs = new URLSearchParams({ q });
  return apiFetch<{ items: { id: string; name: string }[] }>(`/api/telegram/groups/search?${qs.toString()}`);
}

export async function searchTeachers(q: string) {
  const qs = new URLSearchParams({ q });
  return apiFetch<{ items: { id: string; user: { firstName: string; lastName: string; email: string } }[] }>(
    `/api/telegram/teachers/search?${qs.toString()}`
  );
}

export async function searchRooms(q: string) {
  const qs = new URLSearchParams({ q });
  return apiFetch<{ items: { id: string; name: string; capacity: number; hasComputers: boolean }[] }>(
    `/api/telegram/rooms/search?${qs.toString()}`
  );
}

export async function scheduleMe(chatId: string, date?: string) {
  const qs = new URLSearchParams({ chatId, ...(date ? { date } : {}) });
  return apiFetch<any>(`/api/telegram/schedule/me?${qs.toString()}`);
}

export async function scheduleGroup(groupId: string, date?: string) {
  const qs = new URLSearchParams({ groupId, ...(date ? { date } : {}) });
  return apiFetch<any>(`/api/telegram/schedule/group?${qs.toString()}`);
}

export async function scheduleTeacher(teacherId: string, date?: string) {
  const qs = new URLSearchParams({ teacherId, ...(date ? { date } : {}) });
  return apiFetch<any>(`/api/telegram/schedule/teacher?${qs.toString()}`);
}

export async function scheduleRoom(roomId: string, date?: string) {
  const qs = new URLSearchParams({ roomId, ...(date ? { date } : {}) });
  return apiFetch<any>(`/api/telegram/schedule/room?${qs.toString()}`);
}

export async function createChange(chatId: string, body: any) {
  return apiFetch<{ item: any }>("/api/telegram/changes", {
    method: "POST",
    body: JSON.stringify({ chatId, ...body })
  });
}

export async function myChanges(chatId: string) {
  const qs = new URLSearchParams({ chatId });
  return apiFetch<{ items: any[] }>(`/api/telegram/changes/my?${qs.toString()}`);
}
