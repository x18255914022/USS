import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { LessonCreateSchema, LessonUpdateSchema, LessonsListQuerySchema } from "@repo/shared";
import { z } from "zod";

const lessonInclude = {
  academicWeek: true,
  timeslot: { include: { timeslotSet: true } },
  subject: true,
  lessonType: true,
  room: true,
  teachers: { include: { teacher: { include: { user: true } } } },
  groups: { include: { group: true } },
  subgroups: { include: { subgroup: { include: { group: true } } } },
  streamGroups: { include: { streamGroup: true } }
} as const;

async function assertTimeslotInSemester(tx: any, timeslotId: string, semesterId: string) {
  const slot = await tx.timeslot.findUnique({
    where: { id: timeslotId },
    include: { timeslotSet: true }
  });
  if (!slot) return { ok: false as const, error: "INVALID_TIMESLOT" as const };
  if (slot.timeslotSet.semesterId !== semesterId) return { ok: false as const, error: "INVALID_TIMESLOT" as const };
  return { ok: true as const };
}

async function assertWeekInSemester(tx: any, academicWeekId: string, semesterId: string) {
  const week = await tx.academicWeek.findUnique({ where: { id: academicWeekId } });
  if (!week) return { ok: false as const, error: "INVALID_WEEK" as const };
  if (week.semesterId !== semesterId) return { ok: false as const, error: "INVALID_WEEK" as const };
  return { ok: true as const };
}

export async function lessonsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate, app.authorize(["lessons:read"])] }, async (request) => {
    const { page, pageSize, q, semesterId, academicWeekId, dayOfWeek, timeslotId, groupId, teacherId } =
      LessonsListQuerySchema.parse(request.query);

    const where: Record<string, any> = {};
    if (semesterId) where.semesterId = semesterId;
    if (academicWeekId) where.academicWeekId = academicWeekId;
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;
    if (timeslotId) where.timeslotId = timeslotId;
    if (teacherId) where.teachers = { some: { teacherId } };

    if (groupId) {
      where.OR = [
        { groups: { some: { groupId } } },
        { subgroups: { some: { subgroup: { groupId } } } },
        { streamGroups: { some: { streamGroup: { entries: { some: { groupId } } } } } }
      ];
    }

    if (q) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { note: { contains: q } },
            { subject: { name: { contains: q } } },
            { subject: { code: { contains: q } } }
          ]
        }
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.lesson.findMany({
        where,
        include: lessonInclude,
        orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.lesson.count({ where })
    ]);

    return { items, page, pageSize, total };
  });

  app.get(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["lessons:read"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const item = await prisma.lesson.findUnique({ where: { id }, include: lessonInclude });
      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.post("/", { preHandler: [app.authenticate, app.authorize(["lessons:write"])] }, async (request, reply) => {
    const body = LessonCreateSchema.parse(request.body);

    const item = await prisma.$transaction(async (tx) => {
      const semester = await tx.semester.findUnique({ where: { id: body.semesterId } });
      if (!semester) return null;

      const slotCheck = await assertTimeslotInSemester(tx, body.timeslotId, body.semesterId);
      if (!slotCheck.ok) throw new Error(slotCheck.error);

      if (body.academicWeekId) {
        const weekCheck = await assertWeekInSemester(tx, body.academicWeekId, body.semesterId);
        if (!weekCheck.ok) throw new Error(weekCheck.error);
      }

      const created = await tx.lesson.create({
        data: {
          semesterId: body.semesterId,
          academicWeekId: body.academicWeekId ?? null,
          dayOfWeek: body.dayOfWeek,
          timeslotId: body.timeslotId,
          subjectId: body.subjectId,
          lessonTypeId: body.lessonTypeId,
          roomId: body.roomId ?? null,
          note: body.note ?? null
        }
      });

      if (body.teacherIds.length) {
        await tx.lessonTeacher.createMany({
          data: body.teacherIds.map((teacherId) => ({ lessonId: created.id, teacherId }))
        });
      }

      if (body.groupIds.length) {
        await tx.lessonGroup.createMany({
          data: body.groupIds.map((groupId) => ({ lessonId: created.id, groupId }))
        });
      }

      if (body.subgroupIds.length) {
        await tx.lessonSubgroup.createMany({
          data: body.subgroupIds.map((subgroupId) => ({ lessonId: created.id, subgroupId }))
        });
      }

      if (body.streamGroupIds.length) {
        await tx.lessonStreamGroup.createMany({
          data: body.streamGroupIds.map((streamGroupId) => ({ lessonId: created.id, streamGroupId }))
        });
      }

      return tx.lesson.findUniqueOrThrow({ where: { id: created.id }, include: lessonInclude });
    });

    if (!item) return reply.status(400).send({ error: "INVALID_SEMESTER" });
    return reply.status(201).send({ item });
  });

  app.patch(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["lessons:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const body = LessonUpdateSchema.parse(request.body);

      const item = await prisma
        .$transaction(async (tx) => {
          const existing = await tx.lesson.findUnique({ where: { id } });
          if (!existing) return null;

          const nextSemesterId = body.semesterId ?? existing.semesterId;

          if (body.timeslotId) {
            const slotCheck = await assertTimeslotInSemester(tx, body.timeslotId, nextSemesterId);
            if (!slotCheck.ok) throw new Error(slotCheck.error);
          }

          if (body.academicWeekId && body.academicWeekId !== null) {
            const weekCheck = await assertWeekInSemester(tx, body.academicWeekId, nextSemesterId);
            if (!weekCheck.ok) throw new Error(weekCheck.error);
          }

          await tx.lesson.update({
            where: { id },
            data: {
              semesterId: body.semesterId,
              academicWeekId: body.academicWeekId,
              dayOfWeek: body.dayOfWeek,
              timeslotId: body.timeslotId,
              subjectId: body.subjectId,
              lessonTypeId: body.lessonTypeId,
              roomId: body.roomId,
              note: body.note
            }
          });

          if (body.teacherIds) {
            await tx.lessonTeacher.deleteMany({ where: { lessonId: id } });
            if (body.teacherIds.length) {
              await tx.lessonTeacher.createMany({
                data: body.teacherIds.map((teacherId) => ({ lessonId: id, teacherId }))
              });
            }
          }

          if (body.groupIds) {
            await tx.lessonGroup.deleteMany({ where: { lessonId: id } });
            if (body.groupIds.length) {
              await tx.lessonGroup.createMany({
                data: body.groupIds.map((groupId) => ({ lessonId: id, groupId }))
              });
            }
          }

          if (body.subgroupIds) {
            await tx.lessonSubgroup.deleteMany({ where: { lessonId: id } });
            if (body.subgroupIds.length) {
              await tx.lessonSubgroup.createMany({
                data: body.subgroupIds.map((subgroupId) => ({ lessonId: id, subgroupId }))
              });
            }
          }

          if (body.streamGroupIds) {
            await tx.lessonStreamGroup.deleteMany({ where: { lessonId: id } });
            if (body.streamGroupIds.length) {
              await tx.lessonStreamGroup.createMany({
                data: body.streamGroupIds.map((streamGroupId) => ({ lessonId: id, streamGroupId }))
              });
            }
          }

          return tx.lesson.findUniqueOrThrow({ where: { id }, include: lessonInclude });
        })
        .catch(() => null);

      if (!item) return reply.status(404).send({ error: "NOT_FOUND" });
      return { item };
    }
  );

  app.delete(
    "/:id",
    { preHandler: [app.authenticate, app.authorize(["lessons:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const ok = await prisma.lesson.delete({ where: { id } }).then(() => true).catch(() => false);
      if (!ok) return reply.status(404).send({ error: "NOT_FOUND" });
      return reply.status(204).send();
    }
  );
}
