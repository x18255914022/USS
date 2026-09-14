import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "").trim();
  if (!code) return redirect("/profile?error=1");

  try {
    await apiFetchServer("/api/auth/link-telegram", { method: "POST", body: JSON.stringify({ code }) });
    return redirect("/profile?ok=1");
  } catch {
    return redirect("/profile?error=1");
  }
}

