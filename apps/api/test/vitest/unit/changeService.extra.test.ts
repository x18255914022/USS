import { expect, test, vi } from "vitest";
import { createChange } from "../../../src/services/changeService.js";

const U = "00000000-0000-0000-0000-000000000000";
const U1 = "00000000-0000-0000-0000-000000000001";

test("createChange EXTRA: rejects when audience is not exactly one", async () => {
  const res = await createChange({} as any, {
    userId: U,
    data: {
      type: "EXTRA",
      semesterId: U,
      date: new Date("2026-05-16T00:00:00Z"),
      timeslotId: U,
      subjectId: U,
      lessonTypeId: U,
      teacherId: U,
      roomId: U,
      groupId: U,
      subgroupId: U1
    }
  });

  expect(res).toEqual({ ok: false, error: "INVALID" });
});

test("createChange EXTRA: creates change when audience is valid", async () => {
  const db: any = {
    semester: { findUnique: vi.fn().mockResolvedValue({ id: U }) },
    scheduleChange: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: U1 })
    }
  };

  const res = await createChange(db, {
    userId: U,
    data: {
      type: "EXTRA",
      semesterId: U,
      date: new Date("2026-05-16T00:00:00Z"),
      timeslotId: U,
      subjectId: U,
      lessonTypeId: U,
      teacherId: U,
      roomId: U,
      groupId: U
    }
  });

  expect(res).toEqual({ ok: true, item: { id: U1 } });
  expect(db.semester.findUnique).toHaveBeenCalledTimes(1);
  expect(db.scheduleChange.create).toHaveBeenCalledTimes(1);
});

