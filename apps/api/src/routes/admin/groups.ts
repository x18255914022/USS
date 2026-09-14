import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { PaginationQuerySchema, GroupCreateSchema, GroupUpdateSchema } from "@repo/shared";
import { z } from "zod";

export async function groupsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate, app.authorize(["groups:read"])] }, async (request) => {
    const { page, pageSize, q } = PaginationQuerySchema.parse(request.query);

    const where: Record<string, any> = q
      ? {
          OR: [
            { name: { contains: q } },
            { faculty: { code: { contains: q } } },
            { faculty: { name: { contains: q } } }
          ]
        }
      : {};

    const [items, total] = await prisma.$transaction([
      prisma.group.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { faculty: true, _count: { select: { students: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.group.count({ where })
    ]);

    return { items, page, pageSize, total };
  });

  app.get(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["groups:read"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const item = await prisma.group.findUnique({
        where: { id },
        include: { faculty: true, subgroups: { orderBy: { number: "asc" } }, _count: { select: { students: true } } }
      });
      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.post("/", { preHandler: [app.authenticate, app.authorize(["groups:write"])] }, async (request) => {
    const body = GroupCreateSchema.parse(request.body);

    const subgroupCount = body.subgroupCount ?? 0;
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: { name: body.name, course: body.course, facultyId: body.facultyId }
      });

      if (subgroupCount > 0) {
        await tx.subgroup.createMany({
          data: Array.from({ length: subgroupCount }, (_, i) => ({
            groupId: created.id,
            number: i + 1
          }))
        });
      }

      return tx.group.findUniqueOrThrow({
        where: { id: created.id },
        include: { faculty: true, subgroups: { orderBy: { number: "asc" } }, _count: { select: { students: true } } }
      });
    });

    return { item };
  });

  app.patch(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["groups:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const data = GroupUpdateSchema.parse(request.body);

      const item = await prisma.group.update({ where: { id }, data, include: { faculty: true } }).catch(() => null);
      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.delete(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["groups:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const ok = await prisma.group.delete({ where: { id } }).then(() => true).catch(() => false);
      if (!ok) return reply.status(404).send({ error: "NOT_FOUND" });
      return reply.status(204).send();
    }
  );
}

