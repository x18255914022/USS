import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const semesterId = String(form.get("semesterId") ?? "");
  if (!semesterId) return redirect("/manager/settings");

  const intent = String(form.get("intent") ?? "save");

  if (intent === "reset") {
    await apiFetchServer(`/api/semesters/${encodeURIComponent(semesterId)}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ minCancelHours: null, autoApproveReplaceRoom: null })
    });
    return redirect(`/manager/settings?semesterId=${encodeURIComponent(semesterId)}`);
  }

  const minMode = String(form.get("minCancelHoursMode") ?? "default");
  const minRaw = String(form.get("minCancelHours") ?? "").trim();

  const autoMode = String(form.get("autoApproveReplaceRoomMode") ?? "default");

  const body: any = {};

  if (minMode === "default") body.minCancelHours = null;
  if (minMode === "custom") {
    const n = Number(minRaw);
    if (!Number.isFinite(n) || n < 0) return redirect(`/manager/settings?semesterId=${encodeURIComponent(semesterId)}&error=1`);
    body.minCancelHours = n;
  }

  if (autoMode === "default") body.autoApproveReplaceRoom = null;
  if (autoMode === "true") body.autoApproveReplaceRoom = true;
  if (autoMode === "false") body.autoApproveReplaceRoom = false;

  await apiFetchServer(`/api/semesters/${encodeURIComponent(semesterId)}/settings`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });

  return redirect(`/manager/settings?semesterId=${encodeURIComponent(semesterId)}`);
}
