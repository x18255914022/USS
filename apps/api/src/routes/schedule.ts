import type { FastifyInstance } from "fastify";
import { prisma, type Prisma } from "@repo/db";
import {
  ScheduleConflictsQuerySchema,
  ScheduleDateQuerySchema,
  ScheduleEntriesListQuerySchema,
  ScheduleBatchSchema,
  ScheduleEntryCreateSchema,
  ScheduleEntryUpdateSchema,
  PaginationQuerySchema
} from "@repo/shared";
import { z } from "zod";
import { checkConflicts } from "../services/conflictService.js";
import { applyApprovedChangesToLessonItems } from "../services/changeService.js";
import { validateBatch } from "../services/scheduleBatch.js";
import {
  scheduleEntryInclude,
  resolveSemesterAndWeek,
  resolveTimeslots,
  lessonWeekWhere,
  groupAudienceWhere,
  meAudienceWhere,
  isoDow
} from "../lib/scheduleUtils.js";

async function withAppliedChanges(
  items: any[],
  applied: {
    cancelled: Set<string>;
    roomOverride: Map<string, string>;
    rescheduledTo: Map<string, { changeId: string; newDate: Date }>;
  }
) {
  const roomOverrideIds = Array.from(new Set(items.map((it) => applied.roomOverride.get(it.id)).filter(Boolean))) as string[];
  const rooms = roomOverrideIds.length ? await prisma.room.findMany({ where: { id: { in: roomOverrideIds } } }) : [];
  const roomById = new Map(rooms.map((r) => [r.id, r] as const));

  return items.map((it) => {
    const roomOverrideId = applied.roomOverride.get(it.id) ?? null;
    return {
      ...it,
      cancelled: applied.cancelled.has(it.id),
      roomOverrideId,
      roomOverride: roomOverrideId ? roomById.get(roomOverrideId) ?? null : null,
      rescheduledTo: applied.rescheduledTo.get(it.id)?.newDate?.toISOString().slice(0, 10) ?? null
    };
  });
}

// isoDow is now imported from scheduleUtils

async function buildMovedItems(items: any[], moved: any[]) {
  if (!moved.length) return [];

  const baseByLessonId = new Map(items.map((x) => [x.id, x] as const));

  const roomIds = Array.from(new Set(moved.map((m) => m.newRoomId).filter(Boolean))) as string[];
  const timeslotIds = Array.from(new Set(moved.map((m) => m.newTimeslotId).filter(Boolean))) as string[];
  const teacherIds = Array.from(new Set(moved.map((m) => m.newTeacherId).filter(Boolean))) as string[];

  const [rooms, timeslots, teachers] = await Promise.all([
    roomIds.length ? prisma.room.findMany({ where: { id: { in: roomIds } } }) : Promise.resolve([]),
    timeslotIds.length ? prisma.timeslot.findMany({ where: { id: { in: timeslotIds } }, include: { timeslotSet: true } }) : Promise.resolve([]),
    teacherIds.length ? prisma.teacher.findMany({ where: { id: { in: teacherIds } }, include: { user: true } }) : Promise.resolve([])
  ]);

  const roomById = new Map(rooms.map((r) => [r.id, r] as const));
  const timeslotById = new Map(timeslots.map((t) => [t.id, t] as const));
  const teacherById = new Map(teachers.map((t) => [t.id, t] as const));

  const out: any[] = [];
  for (const m of moved) {
    const base = baseByLessonId.get(m.lessonId);
    if (!base) continue;

    const ts = (m.newTimeslotId ? timeslotById.get(m.newTimeslotId) : null) ?? base.timeslot;
    const room = (m.newRoomId ? roomById.get(m.newRoomId) : null) ?? base.room;
    const teacher = m.newTeacherId ? teacherById.get(m.newTeacherId) : null;

    out.push({
      ...base,
      id: `reschedule-${m.changeId}`,
      dayOfWeek: isoDow(m.newDate),
      weekType: "EVERY",
      timeslotId: ts.id,
      timeslot: ts,
      roomId: room?.id ?? null,
      room: room ?? null,
      teachers: teacher ? [{ teacher: { user: teacher.user } }] : base.teachers,
      cancelled: false,
      roomOverrideId: null,
      roomOverride: null,
      rescheduledTo: null,
      movedFrom: m.fromDate.toISOString().slice(0, 10),
      isExtra: false
    });
  }

  return out;
}

async function buildExtraItems(where: any) {
  const changes = await prisma.scheduleChange.findMany({
    where,
    include: {
      newRoom: true,
      newTimeslot: { include: { timeslotSet: true } },
      newTeacher: { include: { user: true } },
      newSubject: true,
      newLessonType: true
    }
  });

  return changes.map((c) => ({
    id: `extra-${c.id}`,
    dayOfWeek: isoDow(c.date),
    weekType: "EVERY",
    timeslotId: c.newTimeslotId!,
    timeslot: c.newTimeslot!,
    subject: c.newSubject!,
    lessonType: c.newLessonType!,
    roomId: c.newRoomId ?? null,
    room: c.newRoom ?? null,
    teachers: c.newTeacher ? [{ teacher: { user: c.newTeacher.user } }] : [],
    cancelled: false,
    roomOverrideId: null,
    roomOverride: null,
    rescheduledTo: null,
    movedFrom: null,
    isExtra: true
  }));
}

function icsEscape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,");
}

function icsDateTimeUtc(d: Date) {
  const yyyy = String(d.getUTCFullYear()).padStart(4, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function dateAtUtc(date: Date, time: string) {
  const [hh, mm] = String(time ?? "00:00").split(":").map((x) => Number(x));
  const d = new Date(date);
  d.setUTCHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d;
}

// These functions are now imported from scheduleUtils:
// - groupAudienceWhere
// - meAudienceWhere
// - resolveSemesterAndWeek
// - resolveTimeslots
// - lessonWeekWhere

export async function scheduleRoutes(app: FastifyInstance) {
  app.post("/entries", { preHandler: [app.authenticate, app.authorize(["schedule:write"])] }, async (request, reply) => {
    const body = ScheduleEntryCreateSchema.parse(request.body);

    const conflicts = await checkConflicts(body);
    if (conflicts.length) return reply.status(409).send({ conflicts });

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.lesson.create({
        data: {
          semesterId: body.semesterId,
          academicWeekId: null,
          dayOfWeek: body.dayOfWeek,
          weekType: body.weekType,
          timeslotId: body.timeslotId,
          subjectId: body.subjectId,
          lessonTypeId: body.lessonTypeId,
          roomId: body.roomId,
          note: body.note ?? null
        }
      });

      await tx.lessonTeacher.create({ data: { lessonId: created.id, teacherId: body.teacherId } });
      if (body.groupId) await tx.lessonGroup.create({ data: { lessonId: created.id, groupId: body.groupId } });
      if (body.subgroupId) await tx.lessonSubgroup.create({ data: { lessonId: created.id, subgroupId: body.subgroupId } });
      if (body.streamGroupId)
        await tx.lessonStreamGroup.create({ data: { lessonId: created.id, streamGroupId: body.streamGroupId } });

      return tx.lesson.findUniqueOrThrow({ where: { id: created.id }, include: scheduleEntryInclude });
    });

    return reply.status(201).send({ item });
  });

  app.post(
    "/entries/batch",
    { preHandler: [app.authenticate, app.authorize(["schedule:write"])] },
    async (request, reply) => {
      const body = ScheduleBatchSchema.parse(request.body);

      // Maximum retry attempts for optimistic locking
      const MAX_RETRIES = 3;
      let attempt = 0;

      while (attempt < MAX_RETRIES) {
        attempt++;

        try {
          const result = await prisma.$transaction(async (tx) => {
            const firstOp = body.ops.find((o: any) => o.type === "create") as any;
            const firstUpdate = body.ops.find((o: any) => o.type === "update") as any;
            const semesterId = (firstOp?.data?.semesterId as string | undefined) ?? undefined;
            const semesterFromUpdate = firstUpdate
              ? await tx.lesson.findUnique({ where: { id: firstUpdate.data.id }, select: { semesterId: true, version: true } })
              : null;

            const sid = semesterId ?? semesterFromUpdate?.semesterId ?? null;
            if (!sid) return { ok: false as const, error: "INVALID_SEMESTER" as const };

            // Fetch existing records with version for optimistic locking
            const existing = await tx.lesson.findMany({
              where: { semesterId: sid, academicWeekId: null },
              include: {
                teachers: { select: { teacherId: true } },
                groups: { select: { groupId: true } },
                subgroups: { select: { subgroupId: true } },
                streamGroups: { select: { streamGroupId: true } }
              }
            });

            const map = new Map<string, any>();
            const versionMap = new Map<string, number>(); // Track versions for optimistic locking

            for (const e of existing) {
              const teacherId = (e as any).teachers?.[0]?.teacherId;
              const groupId = (e as any).groups?.[0]?.groupId;
              const subgroupId = (e as any).subgroups?.[0]?.subgroupId;
              const streamGroupId = (e as any).streamGroups?.[0]?.streamGroupId;
              if (!teacherId || !e.roomId) continue;
              map.set(e.id, {
                id: e.id,
                semesterId: e.semesterId,
                dayOfWeek: e.dayOfWeek,
                weekType: e.weekType,
                timeslotId: e.timeslotId,
                subjectId: e.subjectId,
                lessonTypeId: e.lessonTypeId,
                teacherId,
                roomId: e.roomId,
                note: e.note,
                groupId,
                subgroupId,
                streamGroupId
              });
              versionMap.set(e.id, e.version);
            }

            // Store initial versions to check for conflicts later
            const initialVersions = new Map(versionMap);

            for (let i = 0; i < body.ops.length; i++) {
              const op: any = body.ops[i];
              if (op.type === "delete") {
                map.delete(op.data.id);
                continue;
              }
              if (op.type === "create") {
                const id = String(op.data.clientId ?? `temp-${i}`);
                map.set(id, { id, ...op.data, note: op.data.note ?? null });
                continue;
              }
              if (op.type === "update") {
                const prev = map.get(op.data.id);
                if (!prev) return { ok: false as const, error: "NOT_FOUND" as const };
                const next = { ...prev, ...op.data };
                delete next.id;
                map.set(op.data.id, { ...prev, ...op.data });
                continue;
              }
            }

            const entries = Array.from(map.values());
            const conflicts = await validateBatch(entries);
            if (conflicts.length) return { ok: false as const, error: "CONFLICTS" as const, conflicts };

            const createdMap: { clientId: string; id: string }[] = [];

            for (const op of body.ops as any[]) {
              if (op.type === "delete") {
                // Optimistic locking: delete only if version matches
                const expectedVersion = initialVersions.get(op.data.id);
                if (expectedVersion !== undefined) {
                  const deleted = await tx.lesson.deleteMany({
                    where: { id: op.data.id, version: expectedVersion }
                  });
                  if (deleted.count === 0) {
                    throw new Error("OPTIMISTIC_LOCK_ERROR");
                  }
                } else {
                  await tx.lesson.delete({ where: { id: op.data.id } });
                }
                continue;
              }

              if (op.type === "create") {
                const d = op.data;
                const created = await tx.lesson.create({
                  data: {
                    semesterId: d.semesterId,
                    academicWeekId: null,
                    dayOfWeek: d.dayOfWeek,
                    weekType: d.weekType,
                    timeslotId: d.timeslotId,
                    subjectId: d.subjectId,
                    lessonTypeId: d.lessonTypeId,
                    roomId: d.roomId,
                    note: d.note ?? null,
                    version: 0
                  }
                });

                await tx.lessonTeacher.create({ data: { lessonId: created.id, teacherId: d.teacherId } });
                if (d.groupId) await tx.lessonGroup.create({ data: { lessonId: created.id, groupId: d.groupId } });
                if (d.subgroupId) await tx.lessonSubgroup.create({ data: { lessonId: created.id, subgroupId: d.subgroupId } });
                if (d.streamGroupId)
                  await tx.lessonStreamGroup.create({ data: { lessonId: created.id, streamGroupId: d.streamGroupId } });

                if (d.clientId) {
                  createdMap.push({ clientId: String(d.clientId), id: created.id });
                }
                continue;
              }

              if (op.type === "update") {
                const d = op.data;
                const id = d.id;
                const expectedVersion = initialVersions.get(id);

                // Optimistic locking: update only if version matches and increment version
                const updated = await tx.lesson.updateMany({
                  where: { id, version: expectedVersion },
                  data: {
                    dayOfWeek: d.dayOfWeek,
                    weekType: d.weekType,
                    timeslotId: d.timeslotId,
                    subjectId: d.subjectId,
                    lessonTypeId: d.lessonTypeId,
                    roomId: d.roomId,
                    note: d.note,
                    version: { increment: 1 }
                  }
                });

                if (updated.count === 0) {
                  throw new Error("OPTIMISTIC_LOCK_ERROR");
                }

                if (d.teacherId) {
                  await tx.lessonTeacher.deleteMany({ where: { lessonId: id } });
                  await tx.lessonTeacher.create({ data: { lessonId: id, teacherId: d.teacherId } });
                }

                if (d.groupId || d.subgroupId || d.streamGroupId) {
                  await tx.lessonGroup.deleteMany({ where: { lessonId: id } });
                  await tx.lessonSubgroup.deleteMany({ where: { lessonId: id } });
                  await tx.lessonStreamGroup.deleteMany({ where: { lessonId: id } });

                  if (d.groupId) await tx.lessonGroup.create({ data: { lessonId: id, groupId: d.groupId } });
                  if (d.subgroupId) await tx.lessonSubgroup.create({ data: { lessonId: id, subgroupId: d.subgroupId } });
                  if (d.streamGroupId) await tx.lessonStreamGroup.create({ data: { lessonId: id, streamGroupId: d.streamGroupId } });
                }
              }
            }

            return { ok: true as const, created: createdMap };
          });

          if (!result.ok && result.error === "INVALID_SEMESTER") return reply.status(400).send({ error: "INVALID_SEMESTER" });
          if (!result.ok && result.error === "NOT_FOUND") return reply.status(404).send({ error: "NOT_FOUND" });
          if (!result.ok && result.error === "CONFLICTS") return reply.status(409).send({ conflicts: result.conflicts });
          return { ok: true, created: result.created };

        } catch (err: any) {
          // Check if this is an optimistic lock error
          if (err?.message === "OPTIMISTIC_LOCK_ERROR" || 
              err?.code === 'P2025' || // Prisma "Record to update not found"
              err?.message?.includes("constraint")) {
            if (attempt < MAX_RETRIES) {
              // Wait a bit before retrying (exponential backoff)
              await new Promise(r => setTimeout(r, 100 * attempt));
              continue;
            }
          }
          throw err;
        }
      }

      // If we exhausted all retries
      return reply.status(409).send({ 
        error: "CONCURRENT_MODIFICATION", 
        message: "The schedule was modified by another user. Please refresh and try again."
      });
    }
  );

  app.get("/entries", { preHandler: [app.authenticate, app.authorize(["schedule:read"])] }, async (request) => {
    const { page, pageSize, semesterId, groupId } = ScheduleEntriesListQuerySchema.parse(request.query);

    const where: Prisma.LessonWhereInput = {
      semesterId,
      academicWeekId: null,
      ...groupAudienceWhere(groupId)
    };

    const [items, total] = await prisma.$transaction([
      prisma.lesson.findMany({
        where,
        include: scheduleEntryInclude,
        orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.lesson.count({ where })
    ]);

    return { items, page, pageSize, total };
  });

  app.patch(
    "/entries/:id",
    { preHandler: [app.authenticate, app.authorize(["schedule:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const body = ScheduleEntryUpdateSchema.parse(request.body);

      const existing = await prisma.lesson.findUnique({ where: { id }, include: { groups: true, subgroups: true, streamGroups: true, teachers: true } });
      if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

      const next: any = {
        semesterId: existing.semesterId,
        dayOfWeek: body.dayOfWeek ?? existing.dayOfWeek,
        weekType: body.weekType ?? existing.weekType,
        timeslotId: body.timeslotId ?? existing.timeslotId,
        subjectId: body.subjectId ?? existing.subjectId,
        lessonTypeId: body.lessonTypeId ?? existing.lessonTypeId,
        teacherId: body.teacherId ?? existing.teachers[0]?.teacherId,
        roomId: body.roomId ?? existing.roomId,
        note: body.note ?? existing.note,
        groupId: body.groupId ?? undefined,
        subgroupId: body.subgroupId ?? undefined,
        streamGroupId: body.streamGroupId ?? undefined
      };

      if (!next.teacherId) return reply.status(400).send({ error: "INVALID_TEACHER" });
      if (!next.roomId) return reply.status(400).send({ error: "INVALID_ROOM" });

      if (!body.groupId && !body.subgroupId && !body.streamGroupId) {
        if (existing.groups[0]?.groupId) next.groupId = existing.groups[0].groupId;
        if (existing.subgroups[0]?.subgroupId) next.subgroupId = existing.subgroups[0].subgroupId;
        if (existing.streamGroups[0]?.streamGroupId) next.streamGroupId = existing.streamGroups[0].streamGroupId;
      }

      const conflicts = await checkConflicts(next, id);
      if (conflicts.length) return reply.status(409).send({ conflicts });

      const item = await prisma.$transaction(async (tx) => {
        await tx.lesson.update({
          where: { id },
          data: {
            dayOfWeek: body.dayOfWeek,
            weekType: body.weekType,
            timeslotId: body.timeslotId,
            subjectId: body.subjectId,
            lessonTypeId: body.lessonTypeId,
            roomId: body.roomId,
            note: body.note
          }
        });

        if (body.teacherId) {
          await tx.lessonTeacher.deleteMany({ where: { lessonId: id } });
          await tx.lessonTeacher.create({ data: { lessonId: id, teacherId: body.teacherId } });
        }

        if (body.groupId || body.subgroupId || body.streamGroupId) {
          await tx.lessonGroup.deleteMany({ where: { lessonId: id } });
          await tx.lessonSubgroup.deleteMany({ where: { lessonId: id } });
          await tx.lessonStreamGroup.deleteMany({ where: { lessonId: id } });

          if (body.groupId) await tx.lessonGroup.create({ data: { lessonId: id, groupId: body.groupId } });
          if (body.subgroupId) await tx.lessonSubgroup.create({ data: { lessonId: id, subgroupId: body.subgroupId } });
          if (body.streamGroupId)
            await tx.lessonStreamGroup.create({ data: { lessonId: id, streamGroupId: body.streamGroupId } });
        }

        return tx.lesson.findUniqueOrThrow({ where: { id }, include: scheduleEntryInclude });
      });

      return { item };
    }
  );

  app.delete(
    "/entries/:id",
    { preHandler: [app.authenticate, app.authorize(["schedule:write"])] },
    async (request, reply) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const ok = await prisma.lesson.delete({ where: { id } }).then(() => true).catch(() => false);
      if (!ok) return reply.status(404).send({ error: "NOT_FOUND" });
      return reply.status(204).send();
    }
  );

  app.get(
    "/group/:groupId/export",
    async (request: any, reply) => {
      const groupId = z.string().uuid().parse((request.params as any).groupId);
      const { date } = ScheduleDateQuerySchema.parse(request.query);
      const format = String((request.query as any)?.format ?? "");
      if (format !== "ical") return reply.status(400).send({ error: "INVALID_FORMAT" });

      const token = String((request.query as any)?.token ?? "").trim();
      if (token) {
        try {
          const payload = await app.jwt.verify<{ groupId: string }>(token);
          if (payload.groupId !== groupId) return reply.status(403).send({ error: "FORBIDDEN" });
        } catch {
          return reply.status(401).send({ error: "UNAUTHORIZED" });
        }
      } else {
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({ error: "UNAUTHORIZED" });
        }
        await app.authorize(["schedule:read"])(request, reply);
        if (reply.sent) return;
      }

      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) return reply.status(404).send({ error: "NOT_FOUND" });

      const ctx = await resolveSemesterAndWeek(date ?? new Date());
      if (!ctx) return reply.status(404).send({ error: "NOT_FOUND" });

      const semester = ctx.semester;
      const rangeStart = semester.startDate;
      const rangeEnd = semester.endDate;

      const weeks = await prisma.academicWeek.findMany({
        where: { semesterId: semester.id, isActive: true },
        orderBy: { startDate: "asc" }
      });

      const weekByIso = new Map<string, { id: string; weekType: string }>();
      for (const w of weeks) {
        for (let i = 0; i < 7; i++) {
          const d = new Date(w.startDate);
          d.setUTCDate(d.getUTCDate() + i);
          weekByIso.set(d.toISOString().slice(0, 10), { id: w.id, weekType: w.weekType });
        }
      }

      const lessons = await prisma.lesson.findMany({
        where: {
          semesterId: semester.id,
          academicWeekId: null,
          ...groupAudienceWhere(groupId)
        },
        include: {
          timeslot: true,
          subject: true,
          lessonType: true,
          room: true,
          teachers: { include: { teacher: { include: { user: true } } } }
        },
        orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }]
      });

      const lessonById = new Map(lessons.map((l) => [l.id, l] as const));
      const lessonIds = lessons.map((l) => l.id);

      const changes = await prisma.scheduleChange.findMany({
        where: {
          semesterId: semester.id,
          status: "APPROVED",
          OR: [
            { lessonId: { in: lessonIds }, date: { gte: rangeStart, lte: rangeEnd } },
            { type: "RESCHEDULE", lessonId: { in: lessonIds }, newDate: { gte: rangeStart, lte: rangeEnd } },
            {
              type: "EXTRA",
              date: { gte: rangeStart, lte: rangeEnd },
              OR: [
                { targetGroupId: groupId },
                { targetSubgroup: { groupId } },
                { targetStreamGroup: { entries: { some: { groupId } } } }
              ]
            }
          ]
        },
        include: {
          newRoom: true,
          newTimeslot: true,
          newTeacher: { include: { user: true } },
          newSubject: true,
          newLessonType: true
        }
      });

      const cancelKeys = new Set<string>();
      const roomOverride = new Map<string, string>();
      const rescheduleFrom = new Map<string, any>();
      const rescheduleToByDate = new Map<string, any[]>();
      const extrasByDate = new Map<string, any[]>();

      for (const c of changes) {
        const dayIso = c.date.toISOString().slice(0, 10);
        if (c.type === "CANCEL" && c.lessonId) cancelKeys.add(`${c.lessonId}|${dayIso}`);
        if (c.type === "REPLACE_ROOM" && c.lessonId && c.newRoom) roomOverride.set(`${c.lessonId}|${dayIso}`, c.newRoom.name);
        if (c.type === "RESCHEDULE" && c.lessonId && c.newDate) {
          rescheduleFrom.set(`${c.lessonId}|${dayIso}`, c);
          const toIso = c.newDate.toISOString().slice(0, 10);
          const arr = rescheduleToByDate.get(toIso) ?? [];
          arr.push(c);
          rescheduleToByDate.set(toIso, arr);
        }
        if (c.type === "EXTRA") {
          const arr = extrasByDate.get(dayIso) ?? [];
          arr.push(c);
          extrasByDate.set(dayIso, arr);
        }
      }

      const byDay = new Map<number, any[]>();
      for (const l of lessons) {
        const arr = byDay.get(l.dayOfWeek) ?? [];
        arr.push(l);
        byDay.set(l.dayOfWeek, arr);
      }

      const events: string[] = [];
      const nowStamp = icsDateTimeUtc(new Date());

      const cursor = new Date(rangeStart);
      cursor.setUTCHours(0, 0, 0, 0);
      const end = new Date(rangeEnd);
      end.setUTCHours(0, 0, 0, 0);

      while (cursor.getTime() <= end.getTime()) {
        const dayIso = cursor.toISOString().slice(0, 10);
        const week = weekByIso.get(dayIso);
        const weekType = week?.weekType ?? "EVERY";
        const dow = isoDow(cursor);

        const base = byDay.get(dow) ?? [];
        for (const l of base) {
          const matches =
            (l.academicWeekId && week && l.academicWeekId === week.id) ||
            (!l.academicWeekId && (l.weekType === "EVERY" || l.weekType === weekType));
          if (!matches) continue;

          const key = `${l.id}|${dayIso}`;
          if (rescheduleFrom.has(key)) continue;
          if (cancelKeys.has(key)) continue;

          const roomName = roomOverride.get(key) ?? l.room?.name ?? "";
          const teacher = l.teachers?.[0]?.teacher?.user ? `${l.teachers[0].teacher.user.lastName} ${l.teachers[0].teacher.user.firstName}` : "";

          const dtStart = dateAtUtc(cursor, l.timeslot.startTime);
          const dtEnd = dateAtUtc(cursor, l.timeslot.endTime);

          const uid = `lesson-${l.id}-${dayIso}@university-schedule`;
          const summary = `${l.subject.code} ${l.subject.name}`;
          const description = [teacher ? `Teacher: ${teacher}` : "", l.lessonType?.name ? `Type: ${l.lessonType.name}` : ""].filter(Boolean).join("\\n");

          events.push(
            [
              "BEGIN:VEVENT",
              `UID:${icsEscape(uid)}`,
              `DTSTAMP:${nowStamp}`,
              `DTSTART:${icsDateTimeUtc(dtStart)}`,
              `DTEND:${icsDateTimeUtc(dtEnd)}`,
              `SUMMARY:${icsEscape(summary)}`,
              roomName ? `LOCATION:${icsEscape(roomName)}` : null,
              description ? `DESCRIPTION:${icsEscape(description)}` : null,
              "END:VEVENT"
            ]
              .filter(Boolean)
              .join("\r\n")
          );
        }

        const moved = rescheduleToByDate.get(dayIso) ?? [];
        for (const c of moved) {
          const l = c.lessonId ? lessonById.get(c.lessonId) : null;
          if (!l) continue;
          const ts = c.newTimeslot ?? l.timeslot;
          const roomName = c.newRoom?.name ?? l.room?.name ?? "";
          const teacher = c.newTeacher?.user ? `${c.newTeacher.user.lastName} ${c.newTeacher.user.firstName}` : l.teachers?.[0]?.teacher?.user ? `${l.teachers[0].teacher.user.lastName} ${l.teachers[0].teacher.user.firstName}` : "";

          const dtStart = dateAtUtc(cursor, ts.startTime);
          const dtEnd = dateAtUtc(cursor, ts.endTime);

          const uid = `reschedule-${c.id}@university-schedule`;
          const summary = `${l.subject.code} ${l.subject.name}`;
          const description = [
            `Moved from: ${c.date.toISOString().slice(0, 10)}`,
            teacher ? `Teacher: ${teacher}` : "",
            l.lessonType?.name ? `Type: ${l.lessonType.name}` : ""
          ]
            .filter(Boolean)
            .join("\\n");

          events.push(
            [
              "BEGIN:VEVENT",
              `UID:${icsEscape(uid)}`,
              `DTSTAMP:${nowStamp}`,
              `DTSTART:${icsDateTimeUtc(dtStart)}`,
              `DTEND:${icsDateTimeUtc(dtEnd)}`,
              `SUMMARY:${icsEscape(summary)}`,
              roomName ? `LOCATION:${icsEscape(roomName)}` : null,
              description ? `DESCRIPTION:${icsEscape(description)}` : null,
              "END:VEVENT"
            ]
              .filter(Boolean)
              .join("\r\n")
          );
        }

        const extras = extrasByDate.get(dayIso) ?? [];
        for (const c of extras) {
          if (!c.newTimeslot || !c.newSubject || !c.newLessonType) continue;
          const dtStart = dateAtUtc(cursor, c.newTimeslot.startTime);
          const dtEnd = dateAtUtc(cursor, c.newTimeslot.endTime);
          const uid = `extra-${c.id}@university-schedule`;
          const summary = `${c.newSubject.code} ${c.newSubject.name}`;
          const roomName = c.newRoom?.name ?? "";
          const teacher = c.newTeacher?.user ? `${c.newTeacher.user.lastName} ${c.newTeacher.user.firstName}` : "";
          const description = [teacher ? `Teacher: ${teacher}` : "", c.newLessonType?.name ? `Type: ${c.newLessonType.name}` : ""].filter(Boolean).join("\\n");

          events.push(
            [
              "BEGIN:VEVENT",
              `UID:${icsEscape(uid)}`,
              `DTSTAMP:${nowStamp}`,
              `DTSTART:${icsDateTimeUtc(dtStart)}`,
              `DTEND:${icsDateTimeUtc(dtEnd)}`,
              `SUMMARY:${icsEscape(summary)}`,
              roomName ? `LOCATION:${icsEscape(roomName)}` : null,
              description ? `DESCRIPTION:${icsEscape(description)}` : null,
              "END:VEVENT"
            ]
              .filter(Boolean)
              .join("\r\n")
          );
        }

        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      const ics =
        [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//University Schedule//EN",
          "CALSCALE:GREGORIAN",
          `X-WR-CALNAME:${icsEscape(group.name)}`,
          ...events,
          "END:VCALENDAR"
        ].join("\r\n") + "\r\n";

      reply.header("content-type", "text/calendar; charset=utf-8");
      reply.header("content-disposition", `inline; filename=\"${encodeURIComponent(group.name)}.ics\"`);
      return reply.send(ics);
    }
  );

  app.get(
    "/group/:groupId/export-token",
    { preHandler: [app.authenticate, app.authorize(["schedule:read"])] },
    async (request: any) => {
      const groupId = z.string().uuid().parse((request.params as any).groupId);
      const token = app.jwt.sign({ groupId }, { expiresIn: 365 * 24 * 60 * 60 });
      return { token };
    }
  );

  app.get(
    "/group/:groupId",
    { preHandler: [app.authenticate, app.authorize(["schedule:read"])] },
    async (request, reply) => {
      const groupId = z.string().uuid().parse((request.params as any).groupId);
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

      const movedItems = await buildMovedItems(items as any[], applied.moved);
      const extraItems = await buildExtraItems({
        semesterId: ctx.semester.id,
        status: "APPROVED",
        type: "EXTRA",
        date: { gte: weekStart, lte: weekEnd },
        OR: [
          { targetGroupId: groupId },
          { targetSubgroup: { groupId } },
          { targetStreamGroup: { entries: { some: { groupId } } } }
        ]
      });

      const base = await withAppliedChanges(items as any[], applied as any);
      return { semester: ctx.semester, week: ctx.week, weekType: ctx.weekType, timeslots, items: [...base, ...movedItems, ...extraItems] };
    }
  );

  app.get(
    "/room/:roomId",
    { preHandler: [app.authenticate, app.authorize(["schedule:read"])] },
    async (request, reply) => {
      const roomId = z.string().uuid().parse((request.params as any).roomId);
      const { date } = ScheduleDateQuerySchema.parse(request.query);
      const ctx = await resolveSemesterAndWeek(date ?? new Date());
      if (!ctx) return reply.status(404).send({ error: "NOT_FOUND" });
      const timeslots = await resolveTimeslots(ctx.semester.id);

      const weekStart = ctx.week?.startDate ?? (date ?? new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return reply.status(404).send({ error: "NOT_FOUND" });

      const items = await prisma.lesson.findMany({
        where: {
          semesterId: ctx.semester.id,
          ...lessonWeekWhere(ctx.week, ctx.weekType),
          OR: [
            { roomId },
            { scheduleChanges: { some: { status: "APPROVED", type: "REPLACE_ROOM", date: { gte: weekStart, lte: weekEnd }, newRoomId: roomId } } },
            { scheduleChanges: { some: { status: "APPROVED", type: "RESCHEDULE", newDate: { gte: weekStart, lte: weekEnd }, newRoomId: roomId } } }
          ]
        },
        include: scheduleEntryInclude,
        orderBy: [{ dayOfWeek: "asc" }, { timeslot: { number: "asc" } }]
      });

      const applied = await applyApprovedChangesToLessonItems(prisma, {
        semesterId: ctx.semester.id,
        lessonIds: items.map((x) => x.id),
        from: weekStart,
        to: weekEnd
      });

      const movedItems = (await buildMovedItems(items as any[], applied.moved)).filter((x) => x.room?.id === roomId);
      const extraItems = await buildExtraItems({
        semesterId: ctx.semester.id,
        status: "APPROVED",
        type: "EXTRA",
        date: { gte: weekStart, lte: weekEnd },
        newRoomId: roomId
      });

      const base = await withAppliedChanges(items as any[], applied as any);
      const filtered = base.filter((it: any) => {
        if (it.rescheduledTo && it.roomId === roomId) return true;
        const effectiveRoomId = it.roomOverrideId ?? it.roomId;
        return effectiveRoomId === roomId;
      });

      return { semester: ctx.semester, week: ctx.week, weekType: ctx.weekType, timeslots, room, items: [...filtered, ...movedItems, ...extraItems] };
    }
  );

  app.get(
    "/teacher/:teacherId",
    { preHandler: [app.authenticate, app.authorize(["schedule:read"])] },
    async (request, reply) => {
      const teacherId = z.string().uuid().parse((request.params as any).teacherId);
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

      const movedItems = await buildMovedItems(items as any[], applied.moved);
      const extraItems = await buildExtraItems({
        semesterId: ctx.semester.id,
        status: "APPROVED",
        type: "EXTRA",
        date: { gte: weekStart, lte: weekEnd },
        newTeacherId: teacherId
      });

      const base = await withAppliedChanges(items as any[], applied as any);
      return { semester: ctx.semester, week: ctx.week, weekType: ctx.weekType, timeslots, items: [...base, ...movedItems, ...extraItems] };
    }
  );

  app.get("/me", { preHandler: [app.authenticate, app.authorize(["schedule:read"])] }, async (request: any, reply) => {
    const { date } = ScheduleDateQuerySchema.parse(request.query);
    const userId = request.user?.sub as string | undefined;
    if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const student = await prisma.student.findUnique({ where: { userId } });
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

      const movedItems = await buildMovedItems(items as any[], applied.moved);
      const extraOr: any[] = [{ targetGroupId: student.groupId }, { targetStreamGroup: { entries: { some: { groupId: student.groupId } } } }];
      if (student.subgroupId) extraOr.unshift({ targetSubgroupId: student.subgroupId });
      const extraItems = await buildExtraItems({
        semesterId: ctx.semester.id,
        status: "APPROVED",
        type: "EXTRA",
        date: { gte: weekStart, lte: weekEnd },
        OR: extraOr
      });

      const base = await withAppliedChanges(items as any[], applied as any);
      return {
        kind: "student",
        semester: ctx.semester,
        week: ctx.week,
        weekType: ctx.weekType,
        timeslots,
        items: [...base, ...movedItems, ...extraItems],
        groupId: student.groupId
      };
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId } });
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

      const movedItems = await buildMovedItems(items as any[], applied.moved);
      const extraItems = await buildExtraItems({
        semesterId: ctx.semester.id,
        status: "APPROVED",
        type: "EXTRA",
        date: { gte: weekStart, lte: weekEnd },
        newTeacherId: teacher.id
      });

      const base = await withAppliedChanges(items as any[], applied as any);
      return {
        kind: "teacher",
        semester: ctx.semester,
        week: ctx.week,
        weekType: ctx.weekType,
        timeslots,
        items: [...base, ...movedItems, ...extraItems],
        teacherId: teacher.id
      };
    }

    return { kind: "none", semester: null, week: null, weekType: null, items: [] };
  });

  app.get(
    "/conflicts",
    { preHandler: [app.authenticate, app.authorize(["schedule:read"])] },
    async (request: any) => {
      const { semesterId, groupId, page, pageSize } = ScheduleConflictsQuerySchema.parse(request.query);

      // Get total count for pagination
      const total = await prisma.lesson.count({
        where: {
          semesterId,
          academicWeekId: null,
          ...groupAudienceWhere(groupId)
        }
      });

      const entries = await prisma.lesson.findMany({
        where: {
          semesterId,
          academicWeekId: null,
          ...groupAudienceWhere(groupId)
        },
        select: {
          id: true,
          semesterId: true,
          dayOfWeek: true,
          weekType: true,
          timeslotId: true,
          subjectId: true,
          lessonTypeId: true,
          roomId: true,
          note: true,
          teachers: { select: { teacherId: true } },
          groups: { select: { groupId: true } },
          subgroups: { select: { subgroupId: true } },
          streamGroups: { select: { streamGroupId: true } }
        },
        orderBy: [{ dayOfWeek: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize
      });

      const seen = new Set<string>();
      const items: any[] = [];

      for (const e of entries) {
        const teacherId = e.teachers[0]?.teacherId;
        const roomId = e.roomId;
        if (!teacherId || !roomId) continue;

        const input: any = {
          semesterId: e.semesterId,
          dayOfWeek: e.dayOfWeek,
          weekType: e.weekType,
          timeslotId: e.timeslotId,
          subjectId: e.subjectId,
          lessonTypeId: e.lessonTypeId,
          teacherId,
          roomId,
          note: e.note,
          groupId: e.groups[0]?.groupId,
          subgroupId: e.subgroups[0]?.subgroupId,
          streamGroupId: e.streamGroups[0]?.streamGroupId
        };

        const conflicts = await checkConflicts(input, e.id);
        for (const c of conflicts) {
          const a = e.id;
          const b = c.withEntryId ?? c.type;
          const key = [c.type, a < b ? a : b, a < b ? b : a].join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({ entryId: e.id, ...c });
        }
      }

      return { items, page, pageSize, total };
    }
  );
}
