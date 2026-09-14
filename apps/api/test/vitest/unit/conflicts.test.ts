import { expect, test } from "vitest";
import { conflictWeekTypes } from "../../../src/lib/conflicts.js";

test("conflictWeekTypes: EVERY conflicts with EVERY/UPPER/LOWER", () => {
  expect(conflictWeekTypes("EVERY")).toEqual(["EVERY", "UPPER", "LOWER"]);
});

test("conflictWeekTypes: UPPER conflicts with EVERY/UPPER", () => {
  expect(conflictWeekTypes("UPPER")).toEqual(["EVERY", "UPPER"]);
});

test("conflictWeekTypes: LOWER conflicts with EVERY/LOWER", () => {
  expect(conflictWeekTypes("LOWER")).toEqual(["EVERY", "LOWER"]);
});

