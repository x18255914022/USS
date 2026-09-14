import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:3001";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } })
}

function parseRefreshToken(setCookie: string | null) {
  if (!setCookie) return null;
  const m = setCookie.match(/(?:^|,\s*)refreshToken=([^;]+)/);
  if (!m) return null;
  return m[1] ?? null;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  });

  if (!res.ok) {
    return redirect("/login?error=1");
  }

  const refreshToken = parseRefreshToken(res.headers.get("set-cookie"));
  if (refreshToken) {
    const cookieStore = await cookies();
    cookieStore.set({
      name: "refreshToken",
      value: refreshToken,
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
  }

  return redirect("/schedule");
}
