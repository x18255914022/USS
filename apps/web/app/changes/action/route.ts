import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const actionType = String(form.get("actionType") ?? "");
  const id = String(form.get("id") ?? "");
  const comment = String(form.get("comment") ?? "").trim();

  if (!id) return redirect("/changes");

  try {
    if (actionType === "approve") {
      await apiFetchServer(`/api/changes/${encodeURIComponent(id)}/approve`, { method: "PATCH", body: "{}" });
      return redirect("/changes?status=PENDING");
    }
    if (actionType === "reject") {
      if (!comment) return redirect("/changes?error=comment");
      await apiFetchServer(`/api/changes/${encodeURIComponent(id)}/reject`, { method: "PATCH", body: JSON.stringify({ comment }) });
      return redirect("/changes?status=PENDING");
    }
    if (actionType === "revoke") {
      await apiFetchServer(`/api/changes/${encodeURIComponent(id)}/revoke`, { method: "PATCH", body: "{}" });
      return redirect("/changes");
    }
  } catch {
    return redirect("/changes?error=1");
  }

  return redirect("/changes");
}

