import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@repo/db";
import { ScheduleDateQuerySchema } from "@repo/shared";
import { z } from "zod";
import { env } from "../env.js";
import { generateSixDigitCode, hashLinkCode } from "../lib/telegramLink.js";
import { applyApprovedChangesToLessonItems, createChange, listChanges } from "../services/changeService.js";
import {
  scheduleEntryInclude,
  resolveSemesterAndWeek,
  resolveTimeslots,
  lessonWeekWhere,
  groupAudienceWhere,
  meAudienceWhere
} from "../lib/scheduleUtils.js";

async function withAppliedChanges(items: any[], applied: { cancelled: Set<string>; roomOverride: Map<string, string> }) {
  const roomOverrideIds = Array.from(new Set(items.map((it) => applied.roomOverride.get(it.id)).filter(Boolean))) as string[];
  const rooms = roomOverrideIds.length ? await prisma.room.findMany({ where: { id: { in: roomOverrideIds } } }) : [];
  const roomById = new Map(rooms.map((r) => [r.id, r] as const));

  return items.map((it) => {
    const roomOverrideId = applied.roomOverride.get(it.id) ?? null;
    return {
      ...it,
      cancelled: applied.cancelled.has(it.id),
      roomOverrideId,
      roomOverride: roomOverrideId ? roomById.get(roomOverrideId) ?? null : null
    };
  });
}

const TelegramLinkRequestSchema = z.object({
  telegramChatId: z.string().trim().min(1).max(32)
});

const TelegramLinkConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  telegramChatId: z.string().trim().min(1).max(32).optional()
});

function botAuth(app: FastifyInstance) {
  return async (request: any, reply: any) => {
    const expected = env.BOT_TOKEN;
    if (!expected) return reply.status(503).send({ error: "BOT_NOT_CONFIGURED" });
    const got = request.headers["x-bot-token"];
    if (typeof got !== "string" || got !== expected) return reply.status(401).send({ error: "UNAUTHORIZED" });
  };
}

// These functions are now imported from scheduleUtils

export async function telegramRoutes(app: FastifyInstance) {
  const preHandler = botAuth(app);

  app.post("/link/request", { preHandler: [preHandler] }, async (request, reply) => {
    const body = TelegramLinkRequestSchema.parse(request.body);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.telegramLinkCode.deleteMany({ where: { telegramChatId: body.telegramChatId, consumedAt: null } });

    for (let i = 0; i < 5; i++) {
      const code = generateSixDigitCode();
      const codeHash = hashLinkCode({ code, secret: env.JWT_SECRET });
      const created = await prisma.telegramLinkCode
        .create({
          data: {
            telegramChatId: body.telegramChatId,
            codeHash,
            expiresAt
          }
        })
        .catch(() => null);

      if (created) return reply.send({ code, expiresAt });
    }

    return reply.status(500).send({ error: "CANNOT_GENERATE_CODE" });
  });

  app.post("/link/confirm", { preHandler: [preHandler] }, async (request, reply) => {
    const body = TelegramLinkConfirmSchema.parse(request.body);
    const codeHash = hashLinkCode({ code: body.code, secret: env.JWT_SECRET });

    const row = await prisma.telegramLinkCode.findUnique({ where: { codeHash } });
    if (!row) return reply.status(404).send({ error: "NOT_FOUND" });
    if (row.consumedAt) return reply.status(409).send({ error: "ALREADY_USED" });
    if (row.expiresAt.getTime() <= Date.now()) return reply.status(410).send({ error: "EXPIRED" });

    await prisma.telegramLinkCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return { ok: true, telegramChatId: row.telegramChatId };
  });

  app.get("/groups/search", { preHandler: [preHandler] }, async (request) => {
    const { q } = z.object({ q: z.string().trim().min(1) }).parse(request.query);
    const items = await prisma.group.findMany({
      where: { name: { contains: q } },
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true }
    });
    return { items };
  });

  app.get("/teachers/search", { preHandler: [preHandler] }, async (request) => {
    const { q } = z.object({ q: z.string().trim().min(1) }).parse(request.query);
    const items = await prisma.teacher.findMany({
      where: {
        user: {
          OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } }
    });
    return { items };
  });

  app.get("/rooms/search", { preHandler: [preHandler] }, async (request) => {
    const { q } = z.object({ q: z.string().trim().min(1) }).parse(request.query);
    const items = await prisma.room.findMany({
      where: { name: { contains: q } },
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true, capacity: true, hasComputers: true }
    });
    return { items };
  });

  app.get("/schedule/group", { preHandler: [preHandler] }, async (request, reply) => {
    const { groupId } = z.object({ groupId: z.string().uuid() }).parse(request.query);
    const { date } = ScheduleDateQuerySchema.parse(request.query);
    const ctx = await resolveSemesterAndWeek(date ?? new Date());
    if (!ctx) return reply.status(404).send({ error: "NOT_FOUND" });
    const timeslots = await resolveTimeslots(ctx.semester.id);

    const where: Prisma.LessonWhereInput = {
      semesterId: ctx.semester.id,
      ...lessonWeekWhere(ctx.week, ctx.weekType),
      ...groupAudienceWhere(groupId)
    };

    const items = await prisma.lesson.findMany({
      where,
      include: scheduleEntryInclude,
      orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }]
    });

    const weekStart = ctx.week?.startDate ?? (date ?? new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const applied = await applyApprovedChangesToLessonItems(prisma, {
      semesterId: ctx.semester.id,
      lessonIds: items.map((x) => x.id),
      from: weekStart,
      to: weekEnd
    });

    return {
      semester: ctx.semester,
      week: ctx.week,
      weekType: ctx.weekType,
      timeslots,
      items: await withAppliedChanges(items as any[], applied)
    };
  });

  app.get("/schedule/teacher", { preHandler: [preHandler] }, async (request, reply) => {
    const { teacherId } = z.object({ teacherId: z.string().uuid() }).parse(request.query);
    const { date } = ScheduleDateQuerySchema.parse(request.query);
    const ctx = await resolveSemesterAndWeek(date ?? new Date());
    if (!ctx) return reply.status(404).send({ error: "NOT_FOUND" });
    const timeslots = await resolveTimeslots(ctx.semester.id);

    const where: Prisma.LessonWhereInput = {
      semesterId: ctx.semester.id,
      ...lessonWeekWhere(ctx.week, ctx.weekType),
      teachers: { some: { teacherId } }
    };

    const items = await prisma.lesson.findMany({
      where,
      include: scheduleEntryInclude,
      orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }]
    });

    const weekStart = ctx.week?.startDate ?? (date ?? new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const applied = await applyApprovedChangesToLessonItems(prisma, {
      semesterId: ctx.semester.id,
      lessonIds: items.map((x) => x.id),
      from: weekStart,
      to: weekEnd
    });

    return {
      semester: ctx.semester,
      week: ctx.week,
      weekType: ctx.weekType,
      timeslots,
      items: await withAppliedChanges(items as any[], applied)
    };
  });

  app.get("/schedule/room", { preHandler: [preHandler] }, async (request, reply) => {
    const { roomId } = z.object({ roomId: z.string().uuid() }).parse(request.query);
    const { date } = ScheduleDateQuerySchema.parse(request.query);
    const ctx = await resolveSemesterAndWeek(date ?? new Date());
    if (!ctx) return reply.status(404).send({ error: "NOT_FOUND" });
    const timeslots = await resolveTimeslots(ctx.semester.id);

    const where: Prisma.LessonWhereInput = {
      semesterId: ctx.semester.id,
      ...lessonWeekWhere(ctx.week, ctx.weekType),
      roomId
    };

    const items = await prisma.lesson.findMany({
      where,
      include: scheduleEntryInclude,
      orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }]
    });

    const weekStart = ctx.week?.startDate ?? (date ?? new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const applied = await applyApprovedChangesToLessonItems(prisma, {
      semesterId: ctx.semester.id,
      lessonIds: items.map((x) => x.id),
      from: weekStart,
      to: weekEnd
    });

    return {
      semester: ctx.semester,
      week: ctx.week,
      weekType: ctx.weekType,
      timeslots,
      items: await withAppliedChanges(items as any[], applied)
    };
  });

  app.get("/schedule/me", { preHandler: [preHandler] }, async (request: any, reply) => {
    const { chatId } = z.object({ chatId: z.string().trim().min(1) }).parse(request.query);
    const { date } = ScheduleDateQuerySchema.parse(request.query);

    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) return reply.status(404).send({ error: "NOT_LINKED" });

    const student = await prisma.student.findUnique({ where: { userId: user.id } });
    if (student) {
      const ctx = await resolveSemesterAndWeek(date ?? new Date());
      if (!ctx) return reply.status(404).send({ error: "NOT_FOUND" });
      const timeslots = await resolveTimeslots(ctx.semester.id);

      const where: Prisma.LessonWhereInput = {
        semesterId: ctx.semester.id,
        ...lessonWeekWhere(ctx.week, ctx.weekType),
        ...meAudienceWhere(student)
      };

      const items = await prisma.lesson.findMany({
        where,
        include: scheduleEntryInclude,
        orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }]
      });

      const weekStart = ctx.week?.startDate ?? (date ?? new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const applied = await applyApprovedChangesToLessonItems(prisma, {
        semesterId: ctx.semester.id,
        lessonIds: items.map((x) => x.id),
        from: weekStart,
        to: weekEnd
      });

      return {
        kind: "student",
        semester: ctx.semester,
        week: ctx.week,
        weekType: ctx.weekType,
        timeslots,
        items: await withAppliedChanges(items as any[], applied),
        groupId: student.groupId
      };
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
    if (teacher) {
      const ctx = await resolveSemesterAndWeek(date ?? new Date());
      if (!ctx) return reply.status(404).send({ error: "NOT_FOUND" });
      const timeslots = await resolveTimeslots(ctx.semester.id);

      const where: Prisma.LessonWhereInput = {
        semesterId: ctx.semester.id,
        ...lessonWeekWhere(ctx.week, ctx.weekType),
        teachers: { some: { teacherId: teacher.id } }
      };

      const items = await prisma.lesson.findMany({
        where,
        include: scheduleEntryInclude,
        orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }]
      });

      const weekStart = ctx.week?.startDate ?? (date ?? new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const applied = await applyApprovedChangesToLessonItems(prisma, {
        semesterId: ctx.semester.id,
        lessonIds: items.map((x) => x.id),
        from: weekStart,
        to: weekEnd
      });

      return {
        kind: "teacher",
        semester: ctx.semester,
        week: ctx.week,
        weekType: ctx.weekType,
        timeslots,
        items: await withAppliedChanges(items as any[], applied),
        teacherId: teacher.id
      };
    }

    return reply.status(404).send({ error: "NOT_SUPPORTED" });
  });

  app.post("/changes", { preHandler: [preHandler] }, async (request: any, reply) => {
    const body = z
      .discriminatedUnion("type", [
        z.object({ type: z.literal("CANCEL"), lessonId: z.string().uuid(), date: z.coerce.date(), reason: z.string().trim().min(1).max(500).optional() }),
        z.object({ type: z.literal("REPLACE_ROOM"), lessonId: z.string().uuid(), date: z.coerce.date(), newRoomId: z.string().uuid(), reason: z.string().trim().min(1).max(500).optional() })
      ])
      .and(z.object({ chatId: z.string().trim().min(1) }))
      .parse(request.body);

    const user = await prisma.user.findUnique({ where: { telegramChatId: body.chatId } });
    if (!user) return reply.status(404).send({ error: "NOT_LINKED" });

    const res = await createChange(prisma, { userId: user.id, data: body });
    if (!res.ok && res.error === "NOT_FOUND") return reply.status(404).send({ error: "NOT_FOUND" });
    if (!res.ok && res.error === "DEADLINE") return reply.status(400).send({ error: "DEADLINE" });
    if (!res.ok && res.error === "DUPLICATE") return reply.status(409).send({ error: "DUPLICATE" });
    if (!res.ok) return reply.status(400).send({ error: "INVALID" });
    return reply.status(201).send({ item: res.item });
  });

  app.get("/changes/my", { preHandler: [preHandler] }, async (request: any, reply) => {
    const { chatId } = z.object({ chatId: z.string().trim().min(1) }).parse(request.query);
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) return reply.status(404).send({ error: "NOT_LINKED" });

    const res = await listChanges(prisma, { userId: user.id, query: {} });
    return reply.send({ items: res.items.slice(0, 10) });
  });
}
