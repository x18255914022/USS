import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { ChangeCreateSchema, ChangeRejectBodySchema, ChangesListQuerySchema } from "@repo/shared";
import { z } from "zod";
import { approveChange, createChange, listChanges, rejectChange, revokeChange } from "../services/changeService.js";

export async function changesRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [app.authenticate, app.authorize(["changes:write"])] }, async (request: any, reply) => {
    const body = ChangeCreateSchema.parse(request.body);
    const userId = request.user?.sub as string | undefined;
    if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const res = await createChange(prisma, { userId, data: body });
    if (!res.ok && res.error === "NOT_FOUND") return reply.status(404).send({ error: "NOT_FOUND" });
    if (!res.ok && res.error === "DEADLINE") return reply.status(400).send({ error: "DEADLINE" });
    if (!res.ok && res.error === "DUPLICATE") return reply.status(409).send({ error: "DUPLICATE" });
    if (!res.ok) return reply.status(400).send({ error: "INVALID" });
    return reply.status(201).send({ item: res.item });
  });

  app.get("/", { preHandler: [app.authenticate, app.authorize(["changes:read"])] }, async (request: any, reply) => {
    const query = ChangesListQuerySchema.parse(request.query);
    const userId = request.user?.sub as string | undefined;
    if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    const res = await listChanges(prisma, { userId, query });
    return reply.send({ items: res.items, manager: res.manager });
  });

  app.patch(
    "/:id/approve",
    { preHandler: [app.authenticate, app.authorize(["changes:write"])] },
    async (request: any, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const userId = request.user?.sub as string | undefined;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const res = await approveChange(prisma, { managerId: userId, id });
      if (!res.ok && res.error === "FORBIDDEN") return reply.status(403).send({ error: "FORBIDDEN" });
      if (!res.ok && res.error === "NOT_FOUND") return reply.status(404).send({ error: "NOT_FOUND" });
      if (!res.ok) return reply.status(400).send({ error: "INVALID" });
      return reply.send({ item: res.item });
    }
  );

  app.patch(
    "/:id/reject",
    { preHandler: [app.authenticate, app.authorize(["changes:write"])] },
    async (request: any, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const body = ChangeRejectBodySchema.parse(request.body);
      const userId = request.user?.sub as string | undefined;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const res = await rejectChange(prisma, { managerId: userId, id, comment: body.comment });
      if (!res.ok && res.error === "FORBIDDEN") return reply.status(403).send({ error: "FORBIDDEN" });
      if (!res.ok && res.error === "NOT_FOUND") return reply.status(404).send({ error: "NOT_FOUND" });
      if (!res.ok) return reply.status(400).send({ error: "INVALID" });
      return reply.send({ item: res.item });
    }
  );

  app.patch(
    "/:id/revoke",
    { preHandler: [app.authenticate, app.authorize(["changes:write"])] },
    async (request: any, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const userId = request.user?.sub as string | undefined;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const res = await revokeChange(prisma, { userId, id });
      if (!res.ok && res.error === "FORBIDDEN") return reply.status(403).send({ error: "FORBIDDEN" });
      if (!res.ok && res.error === "INVALID_STATUS") return reply.status(400).send({ error: "INVALID_STATUS" });
      if (!res.ok && res.error === "NOT_FOUND") return reply.status(404).send({ error: "NOT_FOUND" });
      if (!res.ok) return reply.status(400).send({ error: "INVALID" });
      return reply.send({ item: res.item });
    }
  );
}

