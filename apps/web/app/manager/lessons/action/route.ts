import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const actionType = String(form.get("actionType") ?? "");
  const id = String(form.get("id") ?? "");
  const semesterId = String(form.get("semesterId") ?? "");

  const back = semesterId ? `/manager/lessons?semesterId=${encodeURIComponent(semesterId)}` : "/manager/lessons";

  if (actionType === "delete") {
    if (!id) return redirect(back);
    await apiFetchServer(`/api/lessons/${encodeURIComponent(id)}`, { method: "DELETE" });
    return redirect(back);
  }

  const dayOfWeek = String(form.get("dayOfWeek") ?? "");
  const timeslotId = String(form.get("timeslotId") ?? "");
  const subjectId = String(form.get("subjectId") ?? "");
  const lessonTypeId = String(form.get("lessonTypeId") ?? "");
  const roomId = String(form.get("roomId") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();

  const teacherIds = form.getAll("teacherIds").map((v) => String(v));
  const groupIds = form.getAll("groupIds").map((v) => String(v));
  const streamGroupIds = form.getAll("streamGroupIds").map((v) => String(v));

  const payload: any = {
    semesterId,
    dayOfWeek: Number(dayOfWeek),
    timeslotId,
    subjectId,
    lessonTypeId,
    teacherIds,
    groupIds,
    streamGroupIds
  };

  if (roomId) payload.roomId = roomId;
  if (note) payload.note = note;

  if (actionType === "create") {
    await apiFetchServer("/api/lessons", { method: "POST", body: JSON.stringify(payload) });
    return redirect(back);
  }

  if (actionType === "update") {
    if (!id) return redirect(back);
    const updatePayload = { ...payload };
    delete updatePayload.semesterId;
    await apiFetchServer(`/api/lessons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(updatePayload)
    });
    return redirect(back);
  }

  return redirect(back);
}

