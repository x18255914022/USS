import Redis from "ioredis";

let cached: Redis | null = null;

export function getRedis() {
  if (cached) return cached;
  const url = process.env.REDIS_URL?.trim() || "redis://localhost:6379";
  cached = new Redis(url, { maxRetriesPerRequest: null });
  return cached;
}

