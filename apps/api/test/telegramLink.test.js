import test from "node:test";
import assert from "node:assert/strict";
import { generateSixDigitCode, hashLinkCode } from "../dist/lib/telegramLink.js";

test("generateSixDigitCode: returns 6 digits", () => {
  const code = generateSixDigitCode();
  assert.match(code, /^\d{6}$/);
});

test("hashLinkCode: stable for same inputs", () => {
  const h1 = hashLinkCode({ code: "123456", secret: "secret" });
  const h2 = hashLinkCode({ code: "123456", secret: "secret" });
  assert.equal(h1, h2);
});

test("hashLinkCode: differs when code differs", () => {
  const h1 = hashLinkCode({ code: "123456", secret: "secret" });
  const h2 = hashLinkCode({ code: "123457", secret: "secret" });
  assert.notEqual(h1, h2);
});

