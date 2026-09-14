import { NextResponse } from "next/server";
import { ADMIN_RESOURCES } from "../../../lib/adminResources";
import { apiFetchServer } from "../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } })
}

function parseNumber(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const actionType = String(form.get("actionType") ?? "");
  const resourceKey = String(form.get("resource") ?? "");
  const id = String(form.get("id") ?? "");

  const def = (ADMIN_RESOURCES as any)[resourceKey] as (typeof ADMIN_RESOURCES)[keyof typeof ADMIN_RESOURCES] | undefined;
  if (!def) {
    return redirect("/admin");
  }

  const redirectTo = `/admin/${resourceKey}`;

  if (actionType === "delete") {
    if (!id) return redirect(redirectTo);
    await apiFetchServer(`/api/${def.resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
    return redirect(redirectTo);
  }

  const payload: Record<string, unknown> = {};

  for (const f of def.fields) {
    if (f.type === "boolean") {
      payload[f.name] = form.has(f.name);
      continue;
    }

    const raw = form.get(f.name);
    if (raw === null) continue;
    const v = String(raw).trim();
    if (!v) continue;

    if (f.type === "number") {
      const n = parseNumber(v);
      if (n === null) continue;
      payload[f.name] = n;
      continue;
    }

    payload[f.name] = v;
  }

  if (actionType === "create") {
    await apiFetchServer(`/api/${def.resource}`, { method: "POST", body: JSON.stringify(payload) });
    return redirect(redirectTo);
  }

  if (actionType === "update") {
    if (!id) return redirect(redirectTo);
    await apiFetchServer(`/api/${def.resource}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
    return redirect(redirectTo);
  }

  return redirect(redirectTo);
}
