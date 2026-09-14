import { NextResponse } from "next/server";
import { apiFetchServer } from "../../../../lib/serverApi";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const type = String(form.get("type") ?? "");
  const reason = String(form.get("reason") ?? "").trim();

  if (!type) return redirect("/changes/create?error=1");

  try {
    if (type === "EXTRA") {
      const semesterId = String(form.get("semesterId") ?? "");
      const date = String(form.get("date") ?? "");
      const timeslotId = String(form.get("timeslotId") ?? "");
      const subjectId = String(form.get("subjectId") ?? "");
      const lessonTypeId = String(form.get("lessonTypeId") ?? "");
      const teacherId = String(form.get("teacherId") ?? "");
      const roomId = String(form.get("roomId") ?? "");
      const groupId = String(form.get("groupId") ?? "").trim();
      const subgroupId = String(form.get("subgroupId") ?? "").trim();
      const streamGroupId = String(form.get("streamGroupId") ?? "").trim();

      if (!semesterId || !date || !timeslotId || !subjectId || !lessonTypeId || !teacherId || !roomId) {
        return redirect("/changes/create?type=EXTRA&error=1");
      }

      await apiFetchServer("/api/changes", {
        method: "POST",
        body: JSON.stringify({
          type,
          semesterId,
          date,
          timeslotId,
          subjectId,
          lessonTypeId,
          teacherId,
          roomId,
          ...(groupId ? { groupId } : {}),
          ...(subgroupId ? { subgroupId } : {}),
          ...(streamGroupId ? { streamGroupId } : {}),
          ...(reason ? { reason } : {})
        })
      });
    } else if (type === "RESCHEDULE") {
      const lessonId = String(form.get("lessonId") ?? "");
      const date = String(form.get("date") ?? "");
      const newDate = String(form.get("newDate") ?? "");
      const newTimeslotId = String(form.get("newTimeslotId") ?? "").trim();
      const newRoomId = String(form.get("newRoomId") ?? "").trim();
      const newTeacherId = String(form.get("newTeacherId") ?? "").trim();

      if (!lessonId || !date || !newDate) return redirect(`/changes/create?type=RESCHEDULE&date=${encodeURIComponent(date)}&error=1`);

      await apiFetchServer("/api/changes", {
        method: "POST",
        body: JSON.stringify({
          type,
          lessonId,
          date,
          newDate,
          ...(newTimeslotId ? { newTimeslotId } : {}),
          ...(newRoomId ? { newRoomId } : {}),
          ...(newTeacherId ? { newTeacherId } : {}),
          ...(reason ? { reason } : {})
        })
      });
    } else if (type === "REPLACE_ROOM") {
      const lessonId = String(form.get("lessonId") ?? "");
      const date = String(form.get("date") ?? "");
      const newRoomId = String(form.get("newRoomId") ?? "");
      if (!lessonId || !date || !newRoomId) return redirect(`/changes/create?type=REPLACE_ROOM&date=${encodeURIComponent(date)}&error=1`);
      await apiFetchServer("/api/changes", {
        method: "POST",
        body: JSON.stringify({ type, lessonId, date, newRoomId, ...(reason ? { reason } : {}) })
      });
    } else {
      const lessonId = String(form.get("lessonId") ?? "");
      const date = String(form.get("date") ?? "");
      if (!lessonId || !date) return redirect(`/changes/create?type=${encodeURIComponent(type)}&date=${encodeURIComponent(date)}&error=1`);
      await apiFetchServer("/api/changes", {
        method: "POST",
        body: JSON.stringify({ type, lessonId, date, ...(reason ? { reason } : {}) })
      });
    }
    return redirect("/changes?status=PENDING");
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("DEADLINE")) return redirect("/changes/create?error=deadline");
    return redirect("/changes/create?error=1");
  }
}
