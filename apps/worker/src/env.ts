import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

for (const p of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "..", "..", ".env")]) {
  if (fs.existsSync(p)) {
    // Use override: true because other packages may have already loaded a different .env file
    dotenv.config({ path: p, override: true });
    break;
  }
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function optOrNull(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export const env = {
  TELEGRAM_BOT_TOKEN: optOrNull("TELEGRAM_BOT_TOKEN"),
  REDIS_URL: opt("REDIS_URL", "redis://localhost:6379"),
  UNIVERSITY_TZ: opt("UNIVERSITY_TZ", "UTC")
};

