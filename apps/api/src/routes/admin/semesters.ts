import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import {
  AcademicWeeksBulkPatchSchema,
  PaginationQuerySchema,
  SemesterCreateSchema,
  SemesterSettingsUpdateSchema,
  SemesterUpdateSchema,
  TimeslotSetCreateSchema,
  WeekTypeSchema
} from "@repo/shared";
import { z } from "zod";
import { getSettingsForSemester } from "../../services/settingsService.js";

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function buildWeeks(startDate: Date) {
  return Array.from({ length: 18 }, (_, i) => {
    const weekNumber = i + 1;
    const weekType = weekNumber % 2 === 1 ? "UPPER" : "LOWER";
    return {
      weekNumber,
      startDate: addDays(startDate, i * 7),
      weekType,
      isActive: true
    };
  });
}

export async function semestersRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [app.authenticate, app.authorize(["semesters:read"])] },
    async (request) => {
      const { page, pageSize, q } = PaginationQuerySchema.parse(request.query);

      const where: Record<string, any> = q ? { name: { contains: q } } : {};

      const [items, total] = await prisma.$transaction([
        prisma.semester.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        prisma.semester.count({ where })
      ]);

      return { items, page, pageSize, total };
    }
  );

  app.get(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["semesters:read"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const item = await prisma.semester.findUnique({
        where: { id },
        include: {
          weeks: { orderBy: { weekNumber: "asc" } },
          timeslotSets: { include: { timeslots: { orderBy: { number: "asc" } } } }
        }
      });
      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.get(
    "/:id/settings",
    { preHandler: [app.authenticate, app.authorize(["settings:read"])] },
    async (request, reply) => {
      const semesterId = z.string().uuid().parse((request.params as any).id);
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester) return reply.status(404).send({ error: "NOT_FOUND" });
      const settings = await getSettingsForSemester(prisma, semesterId);
      return { semester, global: settings.global, overrides: settings.overrides, effective: { minCancelHours: settings.minCancelHours, autoApproveReplaceRoom: settings.autoApproveReplaceRoom } };
    }
  );

  app.patch(
    "/:id/settings",
    { preHandler: [app.authenticate, app.authorize(["settings:write"])] },
    async (request, reply) => {
      const semesterId = z.string().uuid().parse((request.params as any).id);
      const body = SemesterSettingsUpdateSchema.parse(request.body);
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester) return reply.status(404).send({ error: "NOT_FOUND" });

      const item = await prisma.semesterSettings.upsert({
        where: { semesterId },
        create: {
          id: semesterId,
          semesterId,
          minCancelHours: typeof body.minCancelHours === "number" ? body.minCancelHours : null,
          autoApproveReplaceRoom: typeof body.autoApproveReplaceRoom === "boolean" ? body.autoApproveReplaceRoom : null
        },
        update: {
          ...(body.minCancelHours !== undefined ? { minCancelHours: body.minCancelHours } : {}),
          ...(body.autoApproveReplaceRoom !== undefined ? { autoApproveReplaceRoom: body.autoApproveReplaceRoom } : {})
        }
      });

      const settings = await getSettingsForSemester(prisma, semesterId);
      return { item, effective: { minCancelHours: settings.minCancelHours, autoApproveReplaceRoom: settings.autoApproveReplaceRoom } };
    }
  );

  app.post(
    "/",
    { preHandler: [app.authenticate, app.authorize(["semesters:write"])] },
    async (request) => {
      const body = SemesterCreateSchema.parse(request.body);

      const item = await prisma.$transaction(async (tx) => {
        const created = await tx.semester.create({
          data: {
            name: body.name,
            startDate: body.startDate,
            endDate: body.endDate,
            isActive: false
          }
        });

        await tx.academicWeek.createMany({
          data: buildWeeks(body.startDate).map((w) => ({
            semesterId: created.id,
            weekNumber: w.weekNumber,
            startDate: w.startDate,
            weekType: w.weekType,
            isActive: w.isActive
          }))
        });

        return tx.semester.findUniqueOrThrow({ where: { id: created.id } });
      });

      return { item };
    }
  );

  app.patch(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["semesters:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const data = SemesterUpdateSchema.parse(request.body);

      const item = await prisma.$transaction(async (tx) => {
        const exists = await tx.semester.findUnique({ where: { id } });
        if (!exists) return null;

        if (data.isActive === true) {
          await tx.semester.updateMany({ where: { id: { not: id } }, data: { isActive: false } });
        }

        return tx.semester.update({ where: { id }, data });
      });

      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.delete(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["semesters:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const ok = await prisma.semester.delete({ where: { id } }).then(() => true).catch(() => false);
      if (!ok) return reply.status(404).send({ error: "NOT_FOUND" });
      return reply.status(204).send();
    }
  );

  app.get(
    "/:id/weeks",
    { preHandler: [app.authenticate, app.authorize(["academic_weeks:read"])] },
    async (request, reply) => {
      const semesterId = z.string().uuid().parse((request.params as any).id);
      const exists = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!exists) return reply.status(404).send({ error: "NOT_FOUND" });

      const weeks = await prisma.academicWeek.findMany({
        where: { semesterId },
        orderBy: { weekNumber: "asc" }
      });

      return { weeks };
    }
  );

  app.patch(
    "/:id/weeks",
    { preHandler: [app.authenticate, app.authorize(["academic_weeks:write"])] },
    async (request, reply) => {
      const semesterId = z.string().uuid().parse((request.params as any).id);
      const body = AcademicWeeksBulkPatchSchema.parse(request.body);

      const updates = body.updates.map((u) => ({
        ...u,
        weekType: WeekTypeSchema.parse(u.weekType)
      }));

      const ok = await prisma.$transaction(async (tx) => {
        const exists = await tx.semester.findUnique({ where: { id: semesterId } });
        if (!exists) return false;

        await Promise.all(
          updates.map((u) =>
            tx.academicWeek.updateMany({
              where: { id: u.id, semesterId },
              data: { weekType: u.weekType, isActive: u.isActive }
            })
          )
        );
        return true;
      });

      if (!ok) return reply.status(404).send({ error: "NOT_FOUND" });
      return { ok: true };
    }
  );

  app.post(
    "/:id/timeslot-sets",
    { preHandler: [app.authenticate, app.authorize(["timeslot_sets:write"])] },
    async (request, reply) => {
      const semesterId = z.string().uuid().parse((request.params as any).id);
      const body = TimeslotSetCreateSchema.parse(request.body);

      const item = await prisma.$transaction(async (tx) => {
        const exists = await tx.semester.findUnique({ where: { id: semesterId } });
        if (!exists) return null;

        if (body.isDefault) {
          await tx.timeslotSet.updateMany({ where: { semesterId }, data: { isDefault: false } });
        }

        const created = await tx.timeslotSet.create({
          data: {
            name: body.name,
            semesterId,
            isDefault: body.isDefault,
            timeslots: {
              createMany: {
                data: body.timeslots.map((t) => ({
                  number: t.number,
                  startTime: t.startTime,
                  endTime: t.endTime
                }))
              }
            }
          },
          include: { timeslots: { orderBy: { number: "asc" } } }
        });

        return created;
      });

      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.get(
    "/:id/timeslot-sets",
    { preHandler: [app.authenticate, app.authorize(["timeslot_sets:read"])] },
    async (request, reply) => {
      const semesterId = z.string().uuid().parse((request.params as any).id);
      const exists = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!exists) return reply.status(404).send({ error: "NOT_FOUND" });

      const items = await prisma.timeslotSet.findMany({
        where: { semesterId },
        orderBy: { createdAt: "desc" },
        include: { timeslots: { orderBy: { number: "asc" } } }
      });

      return { items };
    }
  );
}
