import { Queue } from "bullmq";
import { NOTIFICATIONS_QUEUE, getRedis } from "@repo/shared";

let cached: Queue | null = null;

export function getNotificationsQueue() {
  if (cached) return cached;
  cached = new Queue(NOTIFICATIONS_QUEUE, { connection: getRedis() });
  return cached;
}

