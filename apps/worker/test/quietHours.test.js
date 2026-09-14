import test from "node:test";
import assert from "node:assert/strict";
import { computeQuietHoursDelayMs } from "../dist/lib/quietHours.js";

test("computeQuietHoursDelayMs: returns null when quiet hours not configured", () => {
  const now = new Date("2026-05-16T10:00:00Z");
  assert.equal(computeQuietHoursDelayMs({ now, timeZone: "UTC", start: null, end: null }), null);
});

test("computeQuietHoursDelayMs: no delay when outside quiet hours (same-day window)", () => {
  const now = new Date("2026-05-16T10:00:00Z");
  assert.equal(computeQuietHoursDelayMs({ now, timeZone: "UTC", start: 1, end: 6 }), null);
});

test("computeQuietHoursDelayMs: delays until end when inside quiet hours (same-day window)", () => {
  const now = new Date("2026-05-16T03:00:00Z");
  const ms = computeQuietHoursDelayMs({ now, timeZone: "UTC", start: 1, end: 6 });
  assert.ok(typeof ms === "number" && ms > 0);
  const until = new Date(now.getTime() + ms);
  assert.equal(until.toISOString().slice(11, 13), "06");
});

test("computeQuietHoursDelayMs: delays until end when inside quiet hours (cross-midnight window)", () => {
  const now = new Date("2026-05-16T23:00:00Z");
  const ms = computeQuietHoursDelayMs({ now, timeZone: "UTC", start: 22, end: 7 });
  assert.ok(typeof ms === "number" && ms > 0);
  const until = new Date(now.getTime() + ms);
  assert.equal(until.toISOString().slice(11, 13), "07");
});

