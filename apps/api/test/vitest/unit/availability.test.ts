import { expect, test } from "vitest";
import { rankTeachers } from "../../../src/lib/availability.js";

test("rankTeachers: available + teachesSubject first", () => {
  const list = [
    { teacherId: "t1", available: false, teachesSubject: true },
    { teacherId: "t2", available: true, teachesSubject: false },
    { teacherId: "t3", available: true, teachesSubject: true },
    { teacherId: "t4", available: false, teachesSubject: false }
  ];

  const ordered = rankTeachers(list).map((x) => x.teacherId);
  expect(ordered).toEqual(["t3", "t2", "t1", "t4"]);
});

