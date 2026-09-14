import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { PaginationQuerySchema } from "@repo/shared";
import { z } from "zod";

type ListArgs = {
  search?: { fields: string[] };
  where?: (q?: string) => Record<string, any>;
  orderBy?: Record<string, any>;
};

type CrudRoutesOpts<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny> = {
  app: FastifyInstance;
  permissionPrefix: string;
  model: any;
  createSchema: TCreate;
  updateSchema: TUpdate;
  listArgs?: ListArgs;
  softDelete?: boolean;
};

function buildSearchWhere(q: string, fields: string[]) {
  return {
    OR: fields.map((f) => ({
      [f]: { contains: q }
    }))
  };
}

export function registerCrudRoutes<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny>(
  opts: CrudRoutesOpts<TCreate, TUpdate>
) {
  const { app, model, createSchema, updateSchema, permissionPrefix, listArgs, softDelete } = opts;

  app.get(
    "/",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:read`])] },
    async (request) => {
      const { page, pageSize, q } = PaginationQuerySchema.parse(request.query);

      let where: Record<string, any> = {};
      if (softDelete) where = { ...where, isActive: true };

      if (listArgs?.where) {
        where = { ...where, ...listArgs.where(q) };
      } else if (q) {
        where = {
          ...where,
          ...(listArgs?.search?.fields
            ? buildSearchWhere(q, listArgs.search.fields)
            : { name: { contains: q } })
        };
      }

      const orderBy = listArgs?.orderBy ?? { createdAt: "desc" };

      const [items, total] = await prisma.$transaction([
        model.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        model.count({ where })
      ]);

      return { items, page, pageSize, total };
    }
  );

  app.get(
    "/:id",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:read`])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const item = await model.findUnique({ where: { id } });
      if (!item || (softDelete && item.isActive === false)) {
        return reply.status(404).send({ error: "NOT_FOUND" });
      }
      return { item };
    }
  );

  app.post(
    "/",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:write`])] },
    async (request, reply) => {
      const data = createSchema.parse(request.body);
      const item = await model.create({ data });
      return reply.status(201).send({ item });
    }
  );

  app.patch(
    "/:id",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:write`])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const data = updateSchema.parse(request.body);

      if (softDelete) {
        const exists = await model.findUnique({ where: { id } });
        if (!exists || exists.isActive === false) {
          return reply.status(404).send({ error: "NOT_FOUND" });
        }
      }

      const item = await model.update({ where: { id }, data });
      return { item };
    }
  );

  app.delete(
    "/:id",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:write`])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);

      if (softDelete) {
        const exists = await model.findUnique({ where: { id } });
        if (!exists || exists.isActive === false) {
          return reply.status(404).send({ error: "NOT_FOUND" });
        }
        const item = await model.update({ where: { id }, data: { isActive: false } });
        return { item };
      }

      try {
        await model.delete({ where: { id } });
      } catch (err: any) {
        // Handle Prisma-specific errors
        if (err?.code === 'P2025') {
          // Record to delete does not exist
          return reply.status(404).send({ error: "NOT_FOUND" });
        }
        if (err?.code === 'P2003' || err?.code === 'P2014') {
          // Foreign key constraint failed - record is referenced by other records
          return reply.status(409).send({ 
            error: "REFERENCED_RECORD", 
            message: "Cannot delete this record because it is referenced by other records" 
          });
        }
        // Log unexpected errors and return generic message
        console.error('Unexpected error during delete:', err);
        return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
      }

      return { ok: true };
    }
  );
}

