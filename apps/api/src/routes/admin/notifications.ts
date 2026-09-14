import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getNotificationsQueue } from "../../lib/notificationsQueue.js";

export async function notificationsRoutes(app: FastifyInstance) {
  app.get("/stats", { preHandler: [app.authenticate, app.authorize(["notifications:read"])] }, async () => {
    const q = getNotificationsQueue();
    const counts = await q.getJobCounts("wait", "active", "completed", "failed", "delayed");
    return { counts };
  });

  app.get("/failed", { preHandler: [app.authenticate, app.authorize(["notifications:read"])] }, async () => {
    const q = getNotificationsQueue();
    const items = await q.getFailed(0, 19);
    return {
      items: items.map((j: any) => ({
        id: String(j.id),
        name: String(j.name),
        failedReason: j.failedReason ?? null,
        attemptsMade: j.attemptsMade ?? 0,
        timestamp: j.timestamp ?? null
      }))
    };
  });

  app.post(
    "/:jobId/retry",
    { preHandler: [app.authenticate, app.authorize(["notifications:write"])] },
    async (request, reply) => {
      const jobId = z.string().trim().min(1).parse((request.params as any).jobId);
      const q = getNotificationsQueue();
      const job = await q.getJob(jobId);
      if (!job) return reply.status(404).send({ error: "NOT_FOUND" });
      await job.retry().catch(() => null);
      return { ok: true };
    }
  );
}

