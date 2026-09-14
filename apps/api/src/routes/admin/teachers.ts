import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { PaginationQuerySchema, TeachersAvailabilityQuerySchema } from "@repo/shared";
import { z } from "zod";
import { conflictWeekTypes } from "../../lib/conflicts.js";
import { rankTeachers } from "../../lib/availability.js";

const SubjectsBodySchema = z.object({
  subjectIds: z.array(z.string().uuid()).default([])
});

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export async function teachersRoutes(app: FastifyInstance) {
  app.get(
    "/availability",
    { preHandler: [app.authenticate, app.authorize(["schedule:read"])] },
    async (request) => {
      const { dayOfWeek, timeslotId, semesterId, weekType, subjectId } = TeachersAvailabilityQuerySchema.parse(request.query);

      const wts = conflictWeekTypes(weekType);
      const busy = await prisma.lesson.findMany({
        where: {
          semesterId,
          academicWeekId: null,
          dayOfWeek,
          timeslotId,
          weekType: { in: wts }
        },
        include: {
          subject: { select: { code: true, name: true } },
          room: { select: { name: true } },
          teachers: { select: { teacherId: true } }
        }
      });

      const busyByTeacherId = new Map<string, string>();
      for (const l of busy) {
        const teacherId = (l.teachers as any[])[0]?.teacherId as string | undefined;
        if (!teacherId) continue;
        const label = `${l.subject.code}${l.room ? ` · ${l.room.name}` : ""}`;
        if (!busyByTeacherId.has(teacherId)) busyByTeacherId.set(teacherId, label);
      }

      const teachers = await prisma.teacher.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
          subjects: { select: { subjectId: true } }
        }
      });

      const itemsRaw: Array<{
        teacher: { id: string; user: { id: string; email: string; firstName: string; lastName: string; isActive: boolean } };
        teacherId: string;
        available: boolean;
        busyWith: string | null;
        teachesSubject: boolean;
      }> = teachers
        .filter((t) => t.user.isActive)
        .map((t) => {
          const teachesSubject = subjectId ? t.subjects.some((s) => s.subjectId === subjectId) : false;
          const busyWith = busyByTeacherId.get(t.id) ?? null;
          const available = !busyWith;
          return {
            teacher: { id: t.id, user: t.user },
            teacherId: t.id,
            available,
            busyWith,
            teachesSubject
          };
        });

      const ranked = rankTeachers(itemsRaw).sort((a, b) => {
        const av = Number(b.available) - Number(a.available);
        if (av) return av;
        const tv = Number(b.teachesSubject) - Number(a.teachesSubject);
        if (tv) return tv;
        return a.teacher.user.lastName.localeCompare(b.teacher.user.lastName);
      });

      return { items: ranked };
    }
  );

  app.get(
    "/",
    { preHandler: [app.authenticate, app.authorize(["teachers:read"])] },
    async (request) => {
      const { page, pageSize, q } = PaginationQuerySchema.parse(request.query);

      const where: Record<string, any> = q
        ? {
            OR: [
              { user: { email: { contains: q } } },
              { user: { firstName: { contains: q } } },
              { user: { lastName: { contains: q } } }
            ]
          }
        : {};

      const [items, total] = await prisma.$transaction([
        prisma.teacher.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
            department: true,
            subjects: { include: { subject: true } }
          },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.teacher.count({ where })
      ]);

      return { items, page, pageSize, total };
    }
  );

  app.get(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["teachers:read"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const item = await prisma.teacher.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
          department: true,
          subjects: { include: { subject: true } }
        }
      });
      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.patch(
    "/:id/subjects",
    { preHandler: [app.authenticate, app.authorize(["teachers:write"])] },
    async (request, reply) => {
      const teacherId = z.string().uuid().parse((request.params as any).id);
      const body = SubjectsBodySchema.parse(request.body);
      const subjectIds = uniq(body.subjectIds ?? []);

      const item = await prisma.$transaction(async (tx) => {
        const teacher = await tx.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher) return null;

        await tx.teacherSubject.deleteMany({
          where: { teacherId, subjectId: { notIn: subjectIds.length ? subjectIds : ["__none__"] } }
        });

        const existing = await tx.teacherSubject.findMany({
          where: { teacherId },
          select: { subjectId: true }
        });
        const existingSet = new Set(existing.map((x) => x.subjectId));
        const toCreate = subjectIds.filter((sid) => !existingSet.has(sid));

        if (toCreate.length) {
          await tx.teacherSubject.createMany({
            data: toCreate.map((subjectId) => ({ teacherId, subjectId }))
          });
        }

        return tx.teacher.findUniqueOrThrow({
          where: { id: teacherId },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
            department: true,
            subjects: { include: { subject: true } }
          }
        });
      });

      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );
}
