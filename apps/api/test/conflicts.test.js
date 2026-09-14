import test from "node:test";
import assert from "node:assert/strict";
import { conflictWeekTypes } from "../dist/lib/conflicts.js";

test("conflictWeekTypes: EVERY conflicts with EVERY/UPPER/LOWER", () => {
  assert.deepEqual(conflictWeekTypes("EVERY"), ["EVERY", "UPPER", "LOWER"]);
});

test("conflictWeekTypes: UPPER conflicts with EVERY/UPPER", () => {
  assert.deepEqual(conflictWeekTypes("UPPER"), ["EVERY", "UPPER"]);
});

test("conflictWeekTypes: LOWER conflicts with EVERY/LOWER", () => {
  assert.deepEqual(conflictWeekTypes("LOWER"), ["EVERY", "LOWER"]);
});

