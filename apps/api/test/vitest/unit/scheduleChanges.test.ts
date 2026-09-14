import { expect, test } from "vitest";
import { applyApprovedChanges, checkCancelDeadline } from "../../../src/lib/scheduleChanges.js";

test("applyApprovedChanges: marks lesson as cancelled", () => {
  const lessons = [
    { id: "l1", roomId: "r1" },
    { id: "l2", roomId: "r2" }
  ];

  const changes = [{ id: "c1", type: "CANCEL", status: "APPROVED", lessonId: "l1", newRoomId: null }];

  const out = applyApprovedChanges({ lessons, changes });
  expect(out.find((x) => x.id === "l1")?.cancelled).toBe(true);
  expect(out.find((x) => x.id === "l2")?.cancelled).toBe(false);
});

test("applyApprovedChanges: overrides room on REPLACE_ROOM", () => {
  const lessons = [{ id: "l1", roomId: "r1" }];
  const changes = [{ id: "c1", type: "REPLACE_ROOM", status: "APPROVED", lessonId: "l1", newRoomId: "r9" }];
  const out = applyApprovedChanges({ lessons, changes });
  expect(out[0].roomId).toBe("r9");
});

test("applyApprovedChanges: ignores non-approved changes", () => {
  const lessons = [{ id: "l1", roomId: "r1" }];
  const changes = [{ id: "c1", type: "REPLACE_ROOM", status: "PENDING", lessonId: "l1", newRoomId: "r9" }];
  const out = applyApprovedChanges({ lessons, changes });
  expect(out[0].roomId).toBe("r1");
});

test("applyApprovedChanges: last REPLACE_ROOM wins", () => {
  const lessons = [{ id: "l1", roomId: "r1" }];
  const changes = [
    { id: "c1", type: "REPLACE_ROOM", status: "APPROVED", lessonId: "l1", newRoomId: "r2" },
    { id: "c2", type: "REPLACE_ROOM", status: "APPROVED", lessonId: "l1", newRoomId: "r3" }
  ];
  const out = applyApprovedChanges({ lessons, changes });
  expect(out[0].roomId).toBe("r3");
});

test("applyApprovedChanges: supports missing newRoomId", () => {
  const lessons = [{ id: "l1", roomId: "r1" }];
  const changes = [{ id: "c1", type: "REPLACE_ROOM", status: "APPROVED", lessonId: "l1" }];
  const out = applyApprovedChanges({ lessons, changes });
  expect(out[0].roomId).toBe("r1");
});

test("applyApprovedChanges: cancel and replace can combine", () => {
  const lessons = [{ id: "l1", roomId: "r1" }];
  const changes = [
    { id: "c1", type: "REPLACE_ROOM", status: "APPROVED", lessonId: "l1", newRoomId: "r2" },
    { id: "c2", type: "CANCEL", status: "APPROVED", lessonId: "l1", newRoomId: null }
  ];
  const out = applyApprovedChanges({ lessons, changes });
  expect(out[0].roomId).toBe("r2");
  expect(out[0].cancelled).toBe(true);
});

test("checkCancelDeadline: rejects cancellations closer than minHours", () => {
  const ok = checkCancelDeadline({
    now: new Date("2026-05-16T08:00:00Z"),
    lessonStartAt: new Date("2026-05-16T09:30:00Z"),
    minHours: 2
  });
  expect(ok).toBe(false);
});

test("checkCancelDeadline: allows when exactly at deadline", () => {
  const ok = checkCancelDeadline({
    now: new Date("2026-05-16T08:00:00Z"),
    lessonStartAt: new Date("2026-05-16T10:00:00Z"),
    minHours: 2
  });
  expect(ok).toBe(true);
});

test("checkCancelDeadline: allows when far enough", () => {
  const ok = checkCancelDeadline({
    now: new Date("2026-05-16T08:00:00Z"),
    lessonStartAt: new Date("2026-05-16T13:00:00Z"),
    minHours: 2
  });
  expect(ok).toBe(true);
});

