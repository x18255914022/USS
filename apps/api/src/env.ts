import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

let loadedEnvPath: string | null = null;

for (const p of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "..", "..", ".env")]) {
  if (fs.existsSync(p)) {
    // Use override: true because Prisma may have already loaded a different .env file
    dotenv.config({ path: p, override: true });
    loadedEnvPath = p;
    break;
  }
}

if (loadedEnvPath && process.env.DATABASE_URL?.startsWith("file:")) {
  const dbPath = process.env.DATABASE_URL.slice("file:".length);
  if (!path.isAbsolute(dbPath)) {
    process.env.DATABASE_URL = `file:${path.resolve(path.dirname(loadedEnvPath), dbPath)}`;
  }
}

import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  APP_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().optional(),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  BOT_TOKEN: z.string().min(16).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(16).optional(),
  // CORS and security settings
  ALLOWED_ORIGINS: z.string().optional(),
  // JWT token TTL settings (in seconds)
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),
  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  // Body limit in bytes (default 1MB)
  BODY_LIMIT: z.coerce.number().int().positive().default(1048576),
});

export const env = EnvSchema.parse(process.env);
