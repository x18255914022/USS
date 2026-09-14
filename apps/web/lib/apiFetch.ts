import { getAccessToken, setAccessToken } from "./accessToken";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type ApiFetchOpts = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

async function refreshAccessToken() {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: "{}"
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken?: string };
  return data.accessToken ?? null;
}

export async function apiFetch<T>(path: string, opts: ApiFetchOpts = {}): Promise<T> {
  const token = opts.skipAuth ? null : getAccessToken();

  const headers: Record<string, string> = {
    ...(opts.headers ?? {})
  };

  if (!headers["content-type"] && opts.body) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    credentials: "include"
  });

  if (res.status === 401 && !opts.skipRefresh && !opts.skipAuth) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      setAccessToken(null);
      throw new Error("UNAUTHORIZED");
    }

    setAccessToken(refreshed);
    return apiFetch<T>(path, { ...opts, skipRefresh: true });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP_${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
