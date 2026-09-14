import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma, type Prisma, type PrismaClient } from "@repo/db";
import { AdminUserCreateSchema, AdminUserUpdateSchema, PaginationQuerySchema } from "@repo/shared";
import { z } from "zod";

type DbClient = PrismaClient | Prisma.TransactionClient;

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

async function roleIdsByCodes(db: DbClient, codes: string[]) {
  const normalized = uniq(codes.map((c) => c.trim()).filter(Boolean));
  const roles = await db.role.findMany({ where: { code: { in: normalized } } });
  const map = new Map<string, string>(roles.map((r) => [r.code, r.id] as const));
  return { normalized, map };
}

async function ensureStudentProfile(tx: DbClient, userId: string, groupId: string, subgroupId?: string) {
  if (subgroupId) {
    const subgroup = await tx.subgroup.findUnique({ where: { id: subgroupId } });
    if (!subgroup || subgroup.groupId !== groupId) throw new Error("INVALID_SUBGROUP");
  }

  await tx.student.upsert({
    where: { userId },
    create: { userId, groupId, subgroupId },
    update: { groupId, subgroupId }
  });
}

async function ensureTeacherProfile(tx: DbClient, userId: string, departmentId: string, position?: string) {
  await tx.teacher.upsert({
    where: { userId },
    create: { userId, departmentId, position },
    update: { departmentId, position }
  });
}

export async function usersRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [app.authenticate, app.authorize(["users:read"])] },
    async (request) => {
      const { page, pageSize, q } = PaginationQuerySchema.parse(request.query);

      const where: Record<string, any> = q
        ? {
            OR: [
              { email: { contains: q } },
              { firstName: { contains: q } },
              { lastName: { contains: q } }
            ]
          }
        : {};

      const [items, total] = await prisma.$transaction([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: {
            roles: { include: { role: true } },
            student: { include: { group: true, subgroup: true } },
            teacher: {
              include: {
                department: true,
                subjects: { include: { subject: true } }
              }
            }
          },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.user.count({ where })
      ]);

      return { items, page, pageSize, total };
    }
  );

  app.get(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["users:read"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const item = await prisma.user.findUnique({
        where: { id },
        include: {
          roles: { include: { role: true } },
          student: { include: { group: true, subgroup: true } },
          teacher: { include: { department: true, subjects: { include: { subject: true } } } }
        }
      });
      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.post(
    "/",
    { preHandler: [app.authenticate, app.authorize(["users:write"])] },
    async (request, reply) => {
      const body = AdminUserCreateSchema.parse(request.body);
      const { normalized: roleCodes, map } = await roleIdsByCodes(prisma, body.roleCodes);
      if (map.size !== roleCodes.length) return reply.status(400).send({ error: "UNKNOWN_ROLE" });

      if (roleCodes.includes("student") && !body.student) {
        return reply.status(400).send({ error: "STUDENT_GROUP_REQUIRED" });
      }

      if (roleCodes.includes("teacher") && !body.teacher) {
        return reply.status(400).send({ error: "TEACHER_DEPARTMENT_REQUIRED" });
      }

      const passwordHash = await bcrypt.hash(body.password, 10);

      const item = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: body.email,
            passwordHash,
            firstName: body.firstName,
            lastName: body.lastName,
            isActive: body.isActive
          }
        });

        await tx.userRole.createMany({
          data: roleCodes.map((code) => ({
            userId: created.id,
            roleId: map.get(code)!
          }))
        });

        if (roleCodes.includes("student")) {
          await ensureStudentProfile(tx, created.id, body.student!.groupId, body.student!.subgroupId);
        }

        if (roleCodes.includes("teacher")) {
          await ensureTeacherProfile(tx, created.id, body.teacher!.departmentId, body.teacher!.position);
        }

        return tx.user.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            roles: { include: { role: true } },
            student: { include: { group: true, subgroup: true } },
            teacher: { include: { department: true, subjects: { include: { subject: true } } } }
          }
        });
      });

      return { item };
    }
  );

  app.patch(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["users:write"])] },
    async (request, reply) => {
      const userId = z.string().uuid().parse((request.params as any).id);
      const body = AdminUserUpdateSchema.parse(request.body);

      const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;

      const item = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
        if (!user) return null;

        const updateData: Record<string, any> = {};
        if (typeof body.email === "string") updateData.email = body.email;
        if (typeof body.firstName === "string") updateData.firstName = body.firstName;
        if (typeof body.lastName === "string") updateData.lastName = body.lastName;
        if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;
        if (passwordHash) updateData.passwordHash = passwordHash;

        if (Object.keys(updateData).length) {
          await tx.user.update({ where: { id: userId }, data: updateData });
        }

        let roleCodes: string[] | null = null;
        let roleIdMap: Map<string, string> | null = null;

        if (body.roleCodes) {
          const resolved = await roleIdsByCodes(tx, body.roleCodes);
          if (resolved.map.size !== resolved.normalized.length) throw new Error("UNKNOWN_ROLE");
          roleCodes = resolved.normalized;
          roleIdMap = resolved.map;

          const existingRoleIds = new Set(user.roles.map((ur) => ur.roleId));
          const desiredRoleIds = new Set(roleCodes.map((c) => roleIdMap!.get(c)!));

          await tx.userRole.deleteMany({
            where: { userId, roleId: { notIn: Array.from(desiredRoleIds) } }
          });

          const toCreate = Array.from(desiredRoleIds).filter((rid) => !existingRoleIds.has(rid));
          if (toCreate.length) {
            await tx.userRole.createMany({
              data: toCreate.map((roleId) => ({ userId, roleId }))
            });
          }
        } else {
          roleCodes = user.roles.map((ur) => ur.role.code);
        }

        if (roleCodes.includes("student")) {
          if (!body.student) throw new Error("STUDENT_GROUP_REQUIRED");
          await ensureStudentProfile(tx, userId, body.student.groupId, body.student.subgroupId);
        } else {
          await tx.student.deleteMany({ where: { userId } });
        }

        if (roleCodes.includes("teacher")) {
          if (!body.teacher) throw new Error("TEACHER_DEPARTMENT_REQUIRED");
          await ensureTeacherProfile(tx, userId, body.teacher.departmentId, body.teacher.position);
        } else {
          await tx.teacher.deleteMany({ where: { userId } });
        }

        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          include: {
            roles: { include: { role: true } },
            student: { include: { group: true, subgroup: true } },
            teacher: { include: { department: true, subjects: { include: { subject: true } } } }
          }
        });
      }).catch((err) => {
        if (err instanceof Error && err.message === "UNKNOWN_ROLE") return "UNKNOWN_ROLE";
        if (err instanceof Error && err.message === "STUDENT_GROUP_REQUIRED") return "STUDENT_GROUP_REQUIRED";
        if (err instanceof Error && err.message === "TEACHER_DEPARTMENT_REQUIRED") return "TEACHER_DEPARTMENT_REQUIRED";
        if (err instanceof Error && err.message === "INVALID_SUBGROUP") return "INVALID_SUBGROUP";
        throw err;
      });

      if (item === null) return reply.status(404).send({ error: "NOT_FOUND" });
      if (item === "UNKNOWN_ROLE") return reply.status(400).send({ error: "UNKNOWN_ROLE" });
      if (item === "STUDENT_GROUP_REQUIRED") return reply.status(400).send({ error: "STUDENT_GROUP_REQUIRED" });
      if (item === "TEACHER_DEPARTMENT_REQUIRED") return reply.status(400).send({ error: "TEACHER_DEPARTMENT_REQUIRED" });
      if (item === "INVALID_SUBGROUP") return reply.status(400).send({ error: "INVALID_SUBGROUP" });

      return { item };
    }
  );
}
