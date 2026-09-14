import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const actionType = String(form.get("actionType") ?? "");
  const id = String(form.get("id") ?? "");

  if (actionType === "delete") {
    if (!id) return redirect("/admin/stream-groups");
    await apiFetchServer(`/api/stream-groups/${encodeURIComponent(id)}`, { method: "DELETE" });
    return redirect("/admin/stream-groups");
  }

  const name = String(form.get("name") ?? "").trim();
  const groupIds = form.getAll("groupIds").map((v) => String(v));

  if (actionType === "create") {
    await apiFetchServer("/api/stream-groups", { method: "POST", body: JSON.stringify({ name, groupIds }) });
    return redirect("/admin/stream-groups");
  }

  if (actionType === "update") {
    if (!id) return redirect("/admin/stream-groups");
    await apiFetchServer(`/api/stream-groups/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name, groupIds })
    });
    return redirect("/admin/stream-groups");
  }

  return redirect("/admin/stream-groups");
}

