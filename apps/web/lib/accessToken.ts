export const ACCESS_TOKEN_KEY = "accessToken";

let memoryToken: string | null = null;

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  if (memoryToken) return memoryToken;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  memoryToken = token;
  if (!token) {
    try {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {}
    return;
  }
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {}
}
