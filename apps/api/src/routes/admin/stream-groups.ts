import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { PaginationQuerySchema, StreamGroupCreateSchema, StreamGroupUpdateSchema } from "@repo/shared";
import { z } from "zod";

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export async function streamGroupsRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [app.authenticate, app.authorize(["stream_groups:read"])] },
    async (request) => {
      const { page, pageSize, q } = PaginationQuerySchema.parse(request.query);

      const where: Record<string, any> = q
        ? {
            OR: [{ name: { contains: q } }]
          }
        : {};

      const [items, total] = await prisma.$transaction([
        prisma.streamGroup.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: {
            entries: {
              include: {
                group: true
              }
            }
          },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.streamGroup.count({ where })
      ]);

      return { items, page, pageSize, total };
    }
  );

  app.get(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["stream_groups:read"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const item = await prisma.streamGroup.findUnique({
        where: { id },
        include: {
          entries: {
            include: {
              group: true
            }
          }
        }
      });
      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.post(
    "/",
    { preHandler: [app.authenticate, app.authorize(["stream_groups:write"])] },
    async (request) => {
      const body = StreamGroupCreateSchema.parse(request.body);
      const groupIds = uniq(body.groupIds ?? []);

      const item = await prisma.$transaction(async (tx) => {
        const created = await tx.streamGroup.create({
          data: {
            name: body.name
          }
        });

        if (groupIds.length) {
          await tx.streamGroupEntry.createMany({
            data: groupIds.map((groupId) => ({ streamGroupId: created.id, groupId }))
          });
        }

        return tx.streamGroup.findUniqueOrThrow({
          where: { id: created.id },
          include: { entries: { include: { group: true } } }
        });
      });

      return { item };
    }
  );

  app.patch(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["stream_groups:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const body = StreamGroupUpdateSchema.parse(request.body);
      const groupIds = body.groupIds ? uniq(body.groupIds) : null;

      const item = await prisma.$transaction(async (tx) => {
        const exists = await tx.streamGroup.findUnique({ where: { id } });
        if (!exists) return null;

        if (typeof body.name === "string") {
          await tx.streamGroup.update({ where: { id }, data: { name: body.name } });
        }

        if (groupIds) {
          await tx.streamGroupEntry.deleteMany({
            where: { streamGroupId: id, groupId: { notIn: groupIds } }
          });

          const existing = await tx.streamGroupEntry.findMany({
            where: { streamGroupId: id },
            select: { groupId: true }
          });
          const existingSet = new Set(existing.map((e) => e.groupId));
          const toCreate = groupIds.filter((gid) => !existingSet.has(gid));

          if (toCreate.length) {
            await tx.streamGroupEntry.createMany({
              data: toCreate.map((groupId) => ({ streamGroupId: id, groupId }))
            });
          }
        }

        return tx.streamGroup.findUniqueOrThrow({ where: { id }, include: { entries: { include: { group: true } } } });
      });

      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.delete(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["stream_groups:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const ok = await prisma.streamGroup.delete({ where: { id } }).then(() => true).catch(() => false);
      if (!ok) return reply.status(404).send({ error: "NOT_FOUND" });
      return reply.status(204).send();
    }
  );
}

