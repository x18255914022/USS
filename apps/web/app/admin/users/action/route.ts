import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const actionType = String(form.get("actionType") ?? "");
  const id = String(form.get("id") ?? "");

  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const isActive = form.has("isActive");
  const roleCode = String(form.get("roleCode") ?? "").trim();

  const payload: Record<string, unknown> = {
    email,
    firstName,
    lastName,
    isActive,
    roleCodes: roleCode ? [roleCode] : []
  };

  if (password.trim()) payload.password = password;

  const groupId = String(form.get("groupId") ?? "").trim();
  const departmentId = String(form.get("departmentId") ?? "").trim();
  const position = String(form.get("position") ?? "").trim();

  if (roleCode === "student") {
    payload.student = { groupId };
  }

  if (roleCode === "teacher") {
    payload.teacher = { departmentId, ...(position ? { position } : {}) };
  }

  if (actionType === "create") {
    await apiFetchServer("/api/admin/users", { method: "POST", body: JSON.stringify(payload) });
    return redirect("/admin/users");
  }

  if (actionType === "update") {
    if (!id) return redirect("/admin/users");
    await apiFetchServer(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
    return redirect("/admin/users");
  }

  return redirect("/admin/users");
}

