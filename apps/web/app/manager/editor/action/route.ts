import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

function redirectBack(params: Record<string, string>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) usp.set(k, v);
  }
  return redirect(`/manager/editor?${usp.toString()}`);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const actionType = String(form.get("actionType") ?? "");
  const id = String(form.get("id") ?? "");

  const semesterId = String(form.get("semesterId") ?? "");
  const groupId = String(form.get("groupId") ?? "");
  const viewWeekType = String(form.get("viewWeekType") ?? form.get("weekType") ?? "");
  const dayOfWeek = String(form.get("dayOfWeek") ?? "");
  const timeslotId = String(form.get("timeslotId") ?? "");

  const baseParams = {
    semesterId,
    groupId,
    weekType: viewWeekType,
    dayOfWeek,
    timeslotId
  };

  if (actionType === "delete") {
    if (!id) return redirectBack(baseParams);
    await apiFetchServer(`/api/schedule/entries/${encodeURIComponent(id)}`, { method: "DELETE" });
    return redirectBack(baseParams);
  }

  const weekType = String(form.get("weekType") ?? "");
  const subjectId = String(form.get("subjectId") ?? "");
  const lessonTypeId = String(form.get("lessonTypeId") ?? "");
  const teacherId = String(form.get("teacherId") ?? "");
  const roomId = String(form.get("roomId") ?? "");
  const audience = String(form.get("audience") ?? "");
  const note = String(form.get("note") ?? "").trim();

  const [audienceKind, audienceId] = audience.split(":");
  const payload: any = {
    semesterId,
    dayOfWeek: Number(dayOfWeek),
    weekType,
    timeslotId,
    subjectId,
    lessonTypeId,
    teacherId,
    roomId
  };

  if (note) payload.note = note;

  if (audienceKind === "group") payload.groupId = audienceId;
  if (audienceKind === "subgroup") payload.subgroupId = audienceId;
  if (audienceKind === "stream") payload.streamGroupId = audienceId;

  try {
    if (actionType === "create") {
      await apiFetchServer("/api/schedule/entries", { method: "POST", body: JSON.stringify(payload) });
      return redirectBack(baseParams);
    }

    if (actionType === "update") {
      if (!id) return redirectBack(baseParams);
      const updatePayload = { ...payload };
      delete updatePayload.semesterId;
      await apiFetchServer(`/api/schedule/entries/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(updatePayload) });
      return redirectBack({ ...baseParams, entryId: id });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const conflict = message.includes('"conflicts"') || message.includes("TEACHER_BUSY") || message.includes("ROOM_BUSY");
    return redirectBack({ ...baseParams, entryId: id || "", error: conflict ? "conflict" : "1" });
  }

  return redirectBack(baseParams);
}
