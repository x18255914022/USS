import { apiFetch } from "./apiFetch";

export type AuthUser = {
  id: string;
  email: string;
  telegramChatId?: string | null;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
};

export async function apiLogin(body: { email: string; password: string }) {
  return apiFetch<{ accessToken: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true
  });
}

export async function apiRegister(body: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  return apiFetch<{ accessToken: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true
  });
}

export async function apiMe() {
  return apiFetch<{ user: AuthUser | null }>("/api/auth/me");
}

export async function apiRefresh() {
  return apiFetch<{ accessToken: string }>("/api/auth/refresh", {
    method: "POST",
    body: "{}",
    skipAuth: true,
    skipRefresh: true
  });
}
