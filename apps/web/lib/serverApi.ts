import { cookies } from "next/headers";

const API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:3001";

async function refreshCookieHeader() {
  const cookieStore = await cookies();
  const rt = cookieStore.get("refreshToken")?.value;
  if (!rt) return null;
  return `refreshToken=${rt}`;
}

export async function getAccessToken() {
  const cookie = await refreshCookieHeader();
  if (!cookie) return null;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: "{}",
    cache: "no-store"
  });

  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { accessToken?: string } | null;
  return data?.accessToken ?? null;
}

export async function apiFetchServer<T>(path: string, init: RequestInit = {}) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("UNAUTHORIZED");

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP_${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
