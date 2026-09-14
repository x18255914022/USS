import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
// import rateLimit from "@fastify/rate-limit";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter.js";
import { FastifyAdapter } from "@bull-board/fastify";
import { env } from "./env.js";
import { isZodError } from "./lib/zod.js";
import { getNotificationsQueue } from "./lib/notificationsQueue.js";
import { authPlugin } from "./plugins/auth.js";
import { rbacPlugin } from "./plugins/rbac.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin/index.js";
import { changesRoutes } from "./routes/changes.js";
import { scheduleRoutes } from "./routes/schedule.js";
import { telegramRoutes } from "./routes/telegram.js";

function getCorsOrigin(): string | string[] | boolean {
  if (env.ALLOWED_ORIGINS) {
    const origins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    return origins.length === 1 ? origins[0] : origins;
  }
  // Default to APP_URL in production, allow all in development
  return env.NODE_ENV === 'production' ? env.APP_URL : true;
}

export function buildServer() {
  const app = Fastify({ 
    logger: true,
    bodyLimit: env.BODY_LIMIT
  });

  app.setErrorHandler((err, _req, reply) => {
    if (isZodError(err)) {
      // Don't expose internal validation details in production
      const message = env.NODE_ENV === 'production' 
        ? "Invalid input data" 
        : err.message;
      return reply.status(400).send({ 
        error: "VALIDATION_ERROR", 
        message,
        // Only include field names, not values
        fields: err.issues?.map((i: any) => i.path?.join('.')).filter(Boolean)
      });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
  });

  // TODO: Re-enable rate limiting when upgrading to Fastify 5.x
  // Global rate limiting
  // app.register(rateLimit, {
  //   max: env.RATE_LIMIT_MAX,
  //   timeWindow: env.RATE_LIMIT_WINDOW_MS,
  //   keyGenerator: (req) => req.ip || 'anonymous',
  //   errorResponseBuilder: (_req, context) => ({
  //     error: "RATE_LIMIT_EXCEEDED",
  //     message: `Rate limit exceeded. Retry after ${context.after}`,
  //     retryAfter: context.after
  //   })
  // });

  app.register(cors, {
    origin: getCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Bot-Token']
  });

  app.register(cookie);

  app.register(jwt, {
    secret: env.JWT_SECRET
  });

  authPlugin(app);
  rbacPlugin(app);

  const queueAdapter = new FastifyAdapter();
  queueAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(getNotificationsQueue()) as any],
    serverAdapter: queueAdapter
  });

  app.register(
    async (sub) => {
      sub.addHook("preHandler", app.authenticate);
      sub.addHook("preHandler", app.authorize(["queues:read"]));
      await sub.register(queueAdapter.registerPlugin());
    },
    { prefix: "/admin/queues" }
  );

  app.register(healthRoutes);
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(adminRoutes, { prefix: "/api" });
  app.register(changesRoutes, { prefix: "/api/changes" });
  app.register(scheduleRoutes, { prefix: "/api/schedule" });
  app.register(telegramRoutes, { prefix: "/api/telegram" });

  return app;
}
