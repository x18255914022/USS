import test from "node:test";
import assert from "node:assert/strict";
import { exp5BackoffMs } from "../dist/lib/backoff.js";

test("exp5BackoffMs: 5s, 25s, 125s", () => {
  assert.equal(exp5BackoffMs(1), 5000);
  assert.equal(exp5BackoffMs(2), 25000);
  assert.equal(exp5BackoffMs(3), 125000);
});

