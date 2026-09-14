import crypto from "node:crypto";

export function generateSixDigitCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export function hashLinkCode({ code, secret }: { code: string; secret: string }) {
  return crypto.createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

