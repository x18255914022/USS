import { expect, test, vi } from "vitest";
import { getSettingsForSemester } from "../../../src/services/settingsService.js";

test("getSettingsForSemester: falls back to global when no overrides", async () => {
  const db: any = {
    systemSettings: {
      upsert: vi.fn().mockResolvedValue({ id: "default", minCancelHours: 2, autoApproveReplaceRoom: true })
    },
    semesterSettings: {
      findUnique: vi.fn().mockResolvedValue(null)
    }
  };

  const out = await getSettingsForSemester(db, "00000000-0000-0000-0000-000000000001");
  expect(out.minCancelHours).toBe(2);
  expect(out.autoApproveReplaceRoom).toBe(true);
  expect(out.overrides).toBe(null);
});

test("getSettingsForSemester: uses overrides when set", async () => {
  const db: any = {
    systemSettings: {
      upsert: vi.fn().mockResolvedValue({ id: "default", minCancelHours: 2, autoApproveReplaceRoom: true })
    },
    semesterSettings: {
      findUnique: vi.fn().mockResolvedValue({ semesterId: "s1", minCancelHours: 5, autoApproveReplaceRoom: false })
    }
  };

  const out = await getSettingsForSemester(db, "00000000-0000-0000-0000-000000000001");
  expect(out.minCancelHours).toBe(5);
  expect(out.autoApproveReplaceRoom).toBe(false);
});

test("getSettingsForSemester: treats null override as reset", async () => {
  const db: any = {
    systemSettings: {
      upsert: vi.fn().mockResolvedValue({ id: "default", minCancelHours: 2, autoApproveReplaceRoom: true })
    },
    semesterSettings: {
      findUnique: vi.fn().mockResolvedValue({ semesterId: "s1", minCancelHours: null, autoApproveReplaceRoom: null })
    }
  };

  const out = await getSettingsForSemester(db, "00000000-0000-0000-0000-000000000001");
  expect(out.minCancelHours).toBe(2);
  expect(out.autoApproveReplaceRoom).toBe(true);
});

