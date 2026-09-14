import test from "node:test";
import assert from "node:assert/strict";
import { rankTeachers } from "../dist/lib/availability.js";

test("rankTeachers: available + teachesSubject first", () => {
  const list = [
    { teacherId: "t1", available: false, teachesSubject: true },
    { teacherId: "t2", available: true, teachesSubject: false },
    { teacherId: "t3", available: true, teachesSubject: true },
    { teacherId: "t4", available: false, teachesSubject: false }
  ];

  const ordered = rankTeachers(list).map((x) => x.teacherId);
  assert.deepEqual(ordered, ["t3", "t2", "t1", "t4"]);
});

