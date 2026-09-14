import { expect, test } from "vitest";
import { generateSixDigitCode, hashLinkCode } from "../../../src/lib/telegramLink.js";

test("generateSixDigitCode: returns 6 digits", () => {
  const code = generateSixDigitCode();
  expect(code).toMatch(/^\d{6}$/);
});

test("hashLinkCode: stable for same inputs", () => {
  const h1 = hashLinkCode({ code: "123456", secret: "secret" });
  const h2 = hashLinkCode({ code: "123456", secret: "secret" });
  expect(h1).toBe(h2);
});

test("hashLinkCode: differs when code differs", () => {
  const h1 = hashLinkCode({ code: "123456", secret: "secret" });
  const h2 = hashLinkCode({ code: "123457", secret: "secret" });
  expect(h1).not.toBe(h2);
});

