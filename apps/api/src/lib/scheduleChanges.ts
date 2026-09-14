export type ChangeType = "CANCEL" | "REPLACE_ROOM";

export type ApprovedChange = {
  id: string;
  type: ChangeType;
  status: "APPROVED";
  lessonId: string;
  newRoomId: string | null;
};

export function applyApprovedChanges<T extends { id: string; roomId?: string | null }>(input: {
  lessons: T[];
  changes: Array<{ id: string; type: string; status: string; lessonId: string; newRoomId?: string | null }>;
}) {
  const approved = input.changes.filter((c) => c.status === "APPROVED");
  const cancelByLessonId = new Set(approved.filter((c) => c.type === "CANCEL").map((c) => c.lessonId));
  const replaceRoomByLessonId = new Map(
    approved
      .filter((c) => c.type === "REPLACE_ROOM" && typeof c.newRoomId === "string" && c.newRoomId.length)
      .map((c) => [c.lessonId, c.newRoomId as string] as const)
  );

  return input.lessons.map((l) => {
    const roomId = replaceRoomByLessonId.get(l.id) ?? l.roomId;
    const cancelled = cancelByLessonId.has(l.id);
    return { ...l, roomId, cancelled };
  });
}

export function checkCancelDeadline(input: { now: Date; lessonStartAt: Date; minHours: number }) {
  const diffMs = input.lessonStartAt.getTime() - input.now.getTime();
  return diffMs >= input.minHours * 60 * 60 * 1000;
}

