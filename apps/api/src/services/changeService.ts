import { prisma, type Prisma, type PrismaClient } from "@repo/db";
import { checkCancelDeadline } from "../lib/scheduleChanges.js";
import { getNotificationsQueue } from "../lib/notificationsQueue.js";
import { getSettingsForSemester } from "./settingsService.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

async function isManager(db: DbClient, userId: string) {
  const roles = await db.userRole.findMany({ where: { userId }, include: { role: true } });
  return roles.some((r) => r.role.code === "admin" || r.role.code === "manager");
}

async function resolveLesson(db: DbClient, lessonId: string) {
  return db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      timeslot: true,
      subject: true,
      lessonType: true,
      room: true,
      teachers: { include: { teacher: { include: { user: true } } } },
      groups: true,
      subgroups: { include: { subgroup: true } },
      streamGroups: { include: { streamGroup: { include: { entries: true } } } }
    }
  });
}

function lessonStartAt(date: Date, startTime: string) {
  const [hh, mm] = startTime.split(":").map((x) => Number(x));
  const d = new Date(date);
  d.setUTCHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d;
}

async function resolveAudienceStudentUserIds(db: DbClient, lesson: any) {
  const groupIds = new Set<string>();
  for (const g of lesson.groups ?? []) groupIds.add(g.groupId);
  for (const sg of lesson.streamGroups ?? []) for (const e of sg.streamGroup.entries ?? []) groupIds.add(e.groupId);

  const subgroupIds = new Set<string>();
  for (const s of lesson.subgroups ?? []) subgroupIds.add(s.subgroupId);

  const students = subgroupIds.size
    ? await db.student.findMany({ where: { subgroupId: { in: Array.from(subgroupIds) } }, select: { userId: true } })
    : await db.student.findMany({ where: { groupId: { in: Array.from(groupIds) } }, select: { userId: true } });

  return students.map((s) => s.userId);
}

async function resolveExtraAudienceStudentUserIds(db: DbClient, change: any) {
  if (change.targetSubgroupId) {
    const students = await db.student.findMany({ where: { subgroupId: change.targetSubgroupId }, select: { userId: true } });
    return students.map((s) => s.userId);
  }

  if (change.targetGroupId) {
    const students = await db.student.findMany({ where: { groupId: change.targetGroupId }, select: { userId: true } });
    return students.map((s) => s.userId);
  }

  if (change.targetStreamGroupId) {
    const entries = await db.streamGroupEntry.findMany({
      where: { streamGroupId: change.targetStreamGroupId },
      select: { groupId: true }
    });
    const groupIds = Array.from(new Set(entries.map((e) => e.groupId)));
    const students = await db.student.findMany({ where: { groupId: { in: groupIds } }, select: { userId: true } });
    return students.map((s) => s.userId);
  }

  return [];
}

async function notifyApprovedChange(db: DbClient, changeId: string) {
  const change = await db.scheduleChange.findUnique({
    where: { id: changeId },
    include: {
      lesson: {
        include: {
          timeslot: true,
          subject: true,
          room: true,
          teachers: { include: { teacher: { include: { user: true } } } },
          groups: { include: { group: true } },
          subgroups: { include: { subgroup: { include: { group: true } } } },
          streamGroups: { include: { streamGroup: { include: { entries: true } } } }
        }
      },
      newRoom: true,
      newTimeslot: { include: { timeslotSet: true } },
      newTeacher: { include: { user: true } },
      newSubject: true,
      newLessonType: true,
      targetGroup: true,
      targetSubgroup: { include: { group: true } },
      targetStreamGroup: { include: { entries: true } },
      createdBy: true
    }
  });
  if (!change || change.status !== "APPROVED") return;

  if (change.type !== "EXTRA" && !change.lesson) return;

  const studentUserIds =
    change.type === "EXTRA" ? await resolveExtraAudienceStudentUserIds(db, change) : await resolveAudienceStudentUserIds(db, change.lesson);

  const teacherUserIds =
    change.type === "EXTRA"
      ? change.newTeacher?.userId
        ? [change.newTeacher.userId]
        : []
      : (change.lesson.teachers ?? []).map((t: any) => t.teacher.userId).filter(Boolean);

  const userIds = Array.from(new Set([...studentUserIds, ...teacherUserIds]));

  const users = await db.user.findMany({
    where: { id: { in: userIds }, telegramChatId: { not: null } },
    select: { id: true, telegramChatId: true }
  });

  const prefs = await db.notificationPreference.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
    select: { userId: true, telegramEnabled: true, quietHoursStart: true, quietHoursEnd: true }
  });
  const prefByUserId = new Map(prefs.map((p) => [p.userId, p] as const));

  const ts = change.type === "EXTRA" ? change.newTimeslot?.number ?? "—" : change.lesson.timeslot?.number ?? "—";
  const subject = change.type === "EXTRA" ? change.newSubject?.code ?? "—" : change.lesson.subject?.code ?? "—";
  const date = change.date.toISOString().slice(0, 10);

  const text = (() => {
    if (change.type === "CANCEL") return `❌ <b>Отмена пары</b>\n${date} · №${ts} · ${subject}`;
    if (change.type === "REPLACE_ROOM") {
      const to = change.newRoom?.name ?? "—";
      return `🔄 <b>Замена аудитории</b>\n${date} · №${ts} · ${subject}\nНовая аудитория: ${to}`;
    }
    if (change.type === "RESCHEDULE") {
      const to = change.newDate ? change.newDate.toISOString().slice(0, 10) : "—";
      const room = change.newRoom?.name ? `\nАудитория: ${change.newRoom.name}` : "";
      const slot = change.newTimeslot?.number ? `\nСлот: №${change.newTimeslot.number}` : "";
      return `📅 <b>Перенос пары</b>\n${date} · №${ts} · ${subject}\nНовая дата: ${to}${slot}${room}`;
    }
    if (change.type === "EXTRA") {
      const room = change.newRoom?.name ?? "—";
      return `➕ <b>Доп. занятие</b>\n${date} · №${ts} · ${subject}\nАудитория: ${room}`;
    }
    return `ℹ️ <b>Изменение расписания</b>\n${date} · №${ts} · ${subject}`;
  })();

  const queue = getNotificationsQueue();
  const timeZone = process.env.UNIVERSITY_TZ?.trim() || "UTC";

  function computeDelayMs(now: Date, start: number | null | undefined, end: number | null | undefined) {
    if (typeof start !== "number" || typeof end !== "number") return 0;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
    if (start === end) return 0;

    const hourParts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hour12: false }).formatToParts(now);
    const hour = Number(hourParts.find((p) => p.type === "hour")?.value ?? "0");

    const inQuiet = start < end ? hour >= start && hour < end : hour >= start || hour < end;
    if (!inQuiet) return 0;

    const base = new Date(now);
    base.setUTCMinutes(0, 0, 0);
    const deltaDays = start < end ? 0 : hour < end ? 0 : 1;
    base.setUTCDate(base.getUTCDate() + deltaDays);
    base.setUTCHours(end);
    const ms = base.getTime() - now.getTime();
    return ms > 0 ? ms : 0;
  }

  for (const u of users) {
    if (!u.telegramChatId) continue;
    if (prefByUserId.get(u.id)?.telegramEnabled === false) continue;

    const existing = await db.changeNotification.findUnique({
      where: { changeId_userId_channel: { changeId: change.id, userId: u.id, channel: "TELEGRAM" } }
    });
    if (existing && existing.status === "SENT") continue;

    const n = existing
      ? await db.changeNotification.update({
          where: { id: existing.id },
          data: { status: "PENDING", error: null }
        })
      : await db.changeNotification.create({
          data: { changeId: change.id, userId: u.id, channel: "TELEGRAM", status: "PENDING" }
        });

    const pref = prefByUserId.get(u.id);
    const delay = computeDelayMs(new Date(), pref?.quietHoursStart, pref?.quietHoursEnd);

    await queue.add(
      "change_notification",
      { kind: "change_notification", notificationId: n.id, channel: "TELEGRAM", chatId: u.telegramChatId, text },
      {
        attempts: 3,
        backoff: { type: "exp5" },
        priority: 1,
        delay,
        removeOnComplete: { age: 60 * 60 * 24 * 7 },
        removeOnFail: { age: 60 * 60 * 24 * 30 }
      }
    );
  }
}

export async function createChange(db: DbClient, input: { userId: string; data: any }) {
  if (input.data.type === "EXTRA") {
    const audienceCount = [input.data.groupId, input.data.subgroupId, input.data.streamGroupId].filter(Boolean).length;
    if (audienceCount !== 1) return { ok: false as const, error: "INVALID" };

    const semester = await db.semester.findUnique({ where: { id: input.data.semesterId } });
    if (!semester) return { ok: false as const, error: "NOT_FOUND" };

    const existing = await db.scheduleChange.findFirst({
      where: {
        type: "EXTRA",
        semesterId: input.data.semesterId,
        date: input.data.date,
        newTimeslotId: input.data.timeslotId,
        status: { in: ["PENDING", "APPROVED"] },
        ...(input.data.groupId ? { targetGroupId: input.data.groupId } : {}),
        ...(input.data.subgroupId ? { targetSubgroupId: input.data.subgroupId } : {}),
        ...(input.data.streamGroupId ? { targetStreamGroupId: input.data.streamGroupId } : {})
      }
    });
    if (existing) return { ok: false as const, error: "DUPLICATE" };

    const created = await db.scheduleChange.create({
      data: {
        type: "EXTRA",
        status: "PENDING",
        semesterId: input.data.semesterId,
        lessonId: null,
        date: input.data.date,
        reason: input.data.reason ?? null,
        newTimeslotId: input.data.timeslotId,
        newSubjectId: input.data.subjectId,
        newLessonTypeId: input.data.lessonTypeId,
        newTeacherId: input.data.teacherId,
        newRoomId: input.data.roomId,
        targetGroupId: input.data.groupId ?? null,
        targetSubgroupId: input.data.subgroupId ?? null,
        targetStreamGroupId: input.data.streamGroupId ?? null,
        createdById: input.userId
      }
    });

    return { ok: true as const, item: created };
  }

  const lesson = await resolveLesson(db, input.data.lessonId);
  if (!lesson) return { ok: false as const, error: "NOT_FOUND" };

  const settings = await getSettingsForSemester(db, lesson.semesterId);

  if (input.data.type === "CANCEL") {
    const startAt = lessonStartAt(input.data.date, lesson.timeslot.startTime);
    if (!checkCancelDeadline({ now: new Date(), lessonStartAt: startAt, minHours: settings.minCancelHours })) {
      return { ok: false as const, error: "DEADLINE" };
    }
  }

  const existing = await db.scheduleChange.findFirst({
    where: {
      lessonId: lesson.id,
      date: input.data.date,
      type: input.data.type,
      status: { in: ["PENDING", "APPROVED"] }
    }
  });
  if (existing) return { ok: false as const, error: "DUPLICATE" };

  const autoApprove = input.data.type === "REPLACE_ROOM" && settings.autoApproveReplaceRoom;

  const created = await db.scheduleChange.create({
    data: {
      type: input.data.type,
      status: autoApprove ? "APPROVED" : "PENDING",
      semesterId: lesson.semesterId,
      lessonId: lesson.id,
      date: input.data.date,
      newDate: input.data.type === "RESCHEDULE" ? input.data.newDate : null,
      reason: input.data.reason ?? null,
      newRoomId: input.data.type === "REPLACE_ROOM" || input.data.type === "RESCHEDULE" ? input.data.newRoomId ?? null : null,
      newTimeslotId: input.data.type === "RESCHEDULE" ? input.data.newTimeslotId ?? null : null,
      newTeacherId: input.data.type === "RESCHEDULE" ? input.data.newTeacherId ?? null : null,
      createdById: input.userId,
      approvedById: autoApprove ? input.userId : null
    }
  });

  if (autoApprove) await notifyApprovedChange(db, created.id);

  return { ok: true as const, item: created };
}

export async function approveChange(db: DbClient, input: { managerId: string; id: string }) {
  if (!(await isManager(db, input.managerId))) return { ok: false as const, error: "FORBIDDEN" };

  const updated = await db.scheduleChange.update({
    where: { id: input.id },
    data: { status: "APPROVED", approvedById: input.managerId, rejectedById: null, comment: null }
  }).catch(() => null);
  if (!updated) return { ok: false as const, error: "NOT_FOUND" };

  await notifyApprovedChange(db, updated.id);
  return { ok: true as const, item: updated };
}

export async function rejectChange(db: DbClient, input: { managerId: string; id: string; comment: string }) {
  if (!(await isManager(db, input.managerId))) return { ok: false as const, error: "FORBIDDEN" };

  const updated = await db.scheduleChange
    .update({
      where: { id: input.id },
      data: { status: "REJECTED", rejectedById: input.managerId, comment: input.comment }
    })
    .catch(() => null);
  if (!updated) return { ok: false as const, error: "NOT_FOUND" };
  return { ok: true as const, item: updated };
}

export async function revokeChange(db: DbClient, input: { userId: string; id: string }) {
  const change = await db.scheduleChange.findUnique({ where: { id: input.id } });
  if (!change) return { ok: false as const, error: "NOT_FOUND" };
  if (change.createdById !== input.userId) return { ok: false as const, error: "FORBIDDEN" };
  if (change.status !== "PENDING") return { ok: false as const, error: "INVALID_STATUS" };

  const updated = await db.scheduleChange.update({ where: { id: change.id }, data: { status: "REVOKED", revokedAt: new Date() } });
  return { ok: true as const, item: updated };
}

export async function listChanges(db: DbClient, input: { userId: string; query: any }) {
  const manager = await isManager(db, input.userId);
  const where: any = {};
  if (!manager) where.createdById = input.userId;
  if (input.query.status) where.status = input.query.status;
  if (input.query.type) where.type = input.query.type;
  if (input.query.from || input.query.to) where.date = { gte: input.query.from, lte: input.query.to };

  const items = await db.scheduleChange.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      lesson: { include: { timeslot: true, subject: true, room: true } },
      newRoom: true,
      newTimeslot: true,
      newTeacher: { include: { user: true } },
      newSubject: true,
      newLessonType: true,
      targetGroup: true,
      targetSubgroup: { include: { group: true } },
      targetStreamGroup: true,
      createdBy: true,
      approvedBy: true,
      rejectedBy: true
    }
  });
  return { ok: true as const, items, manager };
}

export async function applyApprovedChangesToLessonItems(db: DbClient, input: { semesterId: string; lessonIds: string[]; from: Date; to: Date }) {
  const changes = await db.scheduleChange.findMany({
    where: {
      semesterId: input.semesterId,
      status: "APPROVED",
      lessonId: { in: input.lessonIds },
      OR: [{ date: { gte: input.from, lte: input.to } }, { type: "RESCHEDULE", newDate: { gte: input.from, lte: input.to } }]
    },
    select: { id: true, type: true, lessonId: true, date: true, newDate: true, newRoomId: true, newTimeslotId: true, newTeacherId: true }
  });

  const cancelled = new Set(
    changes
      .filter((c) => c.type === "CANCEL" && c.date >= input.from && c.date <= input.to && c.lessonId)
      .map((c) => c.lessonId as string)
  );

  const roomOverride = new Map(
    changes
      .filter((c) => c.type === "REPLACE_ROOM" && c.newRoomId && c.date >= input.from && c.date <= input.to && c.lessonId)
      .map((c) => [c.lessonId as string, c.newRoomId!] as const)
  );

  const rescheduledTo = new Map(
    changes
      .filter((c) => c.type === "RESCHEDULE" && c.newDate && c.date >= input.from && c.date <= input.to && c.lessonId)
      .map((c) => [c.lessonId as string, { changeId: c.id, newDate: c.newDate!, newTimeslotId: c.newTimeslotId ?? null, newRoomId: c.newRoomId ?? null, newTeacherId: c.newTeacherId ?? null }] as const)
  );

  const moved = changes
    .filter((c) => c.type === "RESCHEDULE" && c.newDate && c.newDate >= input.from && c.newDate <= input.to && c.lessonId)
    .map((c) => ({
      changeId: c.id,
      lessonId: c.lessonId as string,
      fromDate: c.date,
      newDate: c.newDate!,
      newTimeslotId: c.newTimeslotId ?? null,
      newRoomId: c.newRoomId ?? null,
      newTeacherId: c.newTeacherId ?? null
    }));

  return { cancelled, roomOverride, rescheduledTo, moved };
}
