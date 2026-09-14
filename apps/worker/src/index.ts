import { Worker } from "bullmq";
import { prisma } from "@repo/db";
import { NOTIFICATIONS_QUEUE, getRedis, type NotificationJob } from "@repo/shared";
import { env } from "./env.js";
import { exp5BackoffMs } from "./lib/backoff.js";
import { sendTelegramMessage } from "./lib/telegram.js";

// Check if worker can start
if (!env.TELEGRAM_BOT_TOKEN) {
  console.log("[Worker] TELEGRAM_BOT_TOKEN not set. Worker will not start.");
  process.exit(0);
}

process.env.REDIS_URL = env.REDIS_URL;

const redis = getRedis();

const worker = new Worker(
  NOTIFICATIONS_QUEUE,
  async (job) => {
    const data = job.data as NotificationJob;

    if (data.kind === "change_notification") {
      const res = await sendTelegramMessage({ token: env.TELEGRAM_BOT_TOKEN, chatId: data.chatId, text: data.text });
      if (!res.ok) throw new Error(res.error);
      await prisma.changeNotification.update({ where: { id: data.notificationId }, data: { status: "SENT", sentAt: new Date(), error: null } });
      return;
    }

    if (data.kind === "direct_message") {
      const res = await sendTelegramMessage({ token: env.TELEGRAM_BOT_TOKEN, chatId: data.chatId, text: data.text });
      if (!res.ok) throw new Error(res.error);
      return;
    }

    if (data.kind === "class_reminder") {
      const res = await sendTelegramMessage({ token: env.TELEGRAM_BOT_TOKEN, chatId: data.chatId, text: data.text });
      if (!res.ok) throw new Error(res.error);
      await prisma.changeNotification.update({ where: { id: data.notificationId }, data: { status: "SENT", sentAt: new Date(), error: null } });
      return;
    }
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: { max: 30, duration: 1000 },
    settings: {
      backoffStrategy: (attemptsMade, type) => {
        if (type === "exp5") return exp5BackoffMs(attemptsMade);
        return 0;
      }
    }
  }
);

worker.on("failed", async (job, err) => {
  const data = job.data as Partial<NotificationJob> | undefined;
  if (!data || data.kind !== "change_notification") return;

  const attempts = job.opts.attempts ?? 1;
  const isFinal = job.attemptsMade >= attempts;
  if (!isFinal) return;

  const msg = err instanceof Error ? err.message : String(err);
  await prisma.changeNotification
    .update({ where: { id: String(data.notificationId) }, data: { status: "FAILED", error: msg } })
    .catch(() => null);
});

await worker.waitUntilReady();
