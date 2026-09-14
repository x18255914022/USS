import { prisma } from "@repo/db";
import { WeekTypeSchema } from "@repo/shared";
import { conflictWeekTypes } from "../lib/conflicts.js";

export type ScheduleEntryInput = {
  semesterId: string;
  dayOfWeek: number;
  weekType: string;
  timeslotId: string;
  subjectId: string;
  lessonTypeId: string;
  teacherId: string;
  roomId: string;
  note?: string | null;
  groupId?: string;
  subgroupId?: string;
  streamGroupId?: string;
};

export type ScheduleConflict = {
  type: "TEACHER_BUSY" | "ROOM_BUSY" | "AUDIENCE_BUSY" | "ROOM_CAPACITY" | "ROOM_TYPE";
  entryId?: string;
  withEntryId?: string;
  message: string;
};

type AudienceScope = 
  | { kind: "group"; groupId: string }
  | { kind: "subgroup"; subgroupId: string; groupId: string }
  | { kind: "stream"; streamGroupId: string; groupIds: string[] };

// Batch lookup cache to avoid N+1 queries
class AudienceLookupCache {
  private subgroups = new Map<string, { groupId: string } | null>();
  private streamEntries = new Map<string, string[]>();
  private studentCounts = new Map<string, number>();

  async getSubgroup(subgroupId: string): Promise<{ groupId: string } | null> {
    if (!this.subgroups.has(subgroupId)) {
      const subgroup = await prisma.subgroup.findUnique({ 
        where: { id: subgroupId },
        select: { groupId: true }
      });
      this.subgroups.set(subgroupId, subgroup);
    }
    return this.subgroups.get(subgroupId)!;
  }

  async getStreamGroupEntries(streamGroupId: string): Promise<string[]> {
    if (!this.streamEntries.has(streamGroupId)) {
      const entries = await prisma.streamGroupEntry.findMany({
        where: { streamGroupId },
        select: { groupId: true }
      });
      const groupIds = Array.from(new Set(entries.map((e) => e.groupId)));
      this.streamEntries.set(streamGroupId, groupIds);
    }
    return this.streamEntries.get(streamGroupId)!;
  }

  async getStudentCount(where: { groupId?: string; subgroupId?: string; groupIds?: string[] }): Promise<number> {
    const key = where.subgroupId 
      ? `subgroup:${where.subgroupId}`
      : where.groupIds 
        ? `groups:${where.groupIds.sort().join(',')}`
        : `group:${where.groupId}`;

    if (!this.studentCounts.has(key)) {
      const count = await prisma.student.count({
        where: where.subgroupId 
          ? { subgroupId: where.subgroupId }
          : where.groupIds
            ? { groupId: { in: where.groupIds } }
            : { groupId: where.groupId }
      });
      this.studentCounts.set(key, count);
    }
    return this.studentCounts.get(key)!;
  }
}

async function resolveAudienceScope(
  input: Pick<ScheduleEntryInput, "groupId" | "subgroupId" | "streamGroupId">,
  cache: AudienceLookupCache
): Promise<AudienceScope | null> {
  if (input.groupId) {
    return { kind: "group", groupId: input.groupId };
  }

  if (input.subgroupId) {
    const subgroup = await cache.getSubgroup(input.subgroupId);
    if (!subgroup) return null;
    return { kind: "subgroup", subgroupId: input.subgroupId, groupId: subgroup.groupId };
  }

  if (input.streamGroupId) {
    const groupIds = await cache.getStreamGroupEntries(input.streamGroupId);
    return { kind: "stream", streamGroupId: input.streamGroupId, groupIds };
  }

  return null;
}

async function resolveAudienceSize(audience: AudienceScope, cache: AudienceLookupCache) {
  if (audience.kind === "group") {
    const count = await cache.getStudentCount({ groupId: audience.groupId });
    return { size: count, groupIds: [audience.groupId] };
  }

  if (audience.kind === "subgroup") {
    const count = await cache.getStudentCount({ subgroupId: audience.subgroupId });
    return { size: count, groupIds: [audience.groupId] };
  }

  const count = await cache.getStudentCount({ groupIds: audience.groupIds });
  return { size: count, groupIds: audience.groupIds };
}

function lessonSlotWhere(input: ScheduleEntryInput, excludeId?: string) {
  const weekType = WeekTypeSchema.parse(input.weekType);
  const weekTypes = conflictWeekTypes(weekType);

  return {
    semesterId: input.semesterId,
    academicWeekId: null,
    dayOfWeek: input.dayOfWeek,
    timeslotId: input.timeslotId,
    weekType: { in: weekTypes },
    ...(excludeId ? { id: { not: excludeId } } : {})
  };
}

export async function checkConflicts(input: ScheduleEntryInput, excludeId?: string) {
  const conflicts: ScheduleConflict[] = [];
  const slotWhere = lessonSlotWhere(input, excludeId);
  const cache = new AudienceLookupCache();

  // Run independent queries in parallel
  const [teacherBusy, roomBusy, room, lessonType] = await Promise.all([
    prisma.lesson.findFirst({
      where: { ...slotWhere, teachers: { some: { teacherId: input.teacherId } } },
      select: { id: true }
    }),
    prisma.lesson.findFirst({
      where: { ...slotWhere, roomId: input.roomId },
      select: { id: true }
    }),
    prisma.room.findUnique({ where: { id: input.roomId } }),
    prisma.lessonType.findUnique({ where: { id: input.lessonTypeId } })
  ]);

  if (teacherBusy) {
    conflicts.push({
      type: "TEACHER_BUSY",
      withEntryId: teacherBusy.id,
      message: "Преподаватель занят в этот слот"
    });
  }

  if (roomBusy) {
    conflicts.push({
      type: "ROOM_BUSY",
      withEntryId: roomBusy.id,
      message: "Аудитория занята в этот слот"
    });
  }

  const audience = await resolveAudienceScope(input, cache);
  if (!audience) {
    conflicts.push({ type: "AUDIENCE_BUSY", message: "Не указана аудитория" });
    return conflicts;
  }

  // Check room capacity
  const audienceSize = await resolveAudienceSize(audience, cache);
  if (room && audienceSize && room.capacity < audienceSize.size) {
    conflicts.push({
      type: "ROOM_CAPACITY",
      message: `Вместимость аудитории меньше размера группы (${room.capacity} < ${audienceSize.size})`
    });
  }

  // Check room type requirements
  if (lessonType?.code === "lab" && room && !room.hasComputers) {
    conflicts.push({
      type: "ROOM_TYPE",
      message: "Для лабораторной требуется аудитория с компьютерами"
    });
  }

  // Build audience where clause based on type
  let audienceWhere: { OR: any[] };
  if (audience.kind === "group") {
    audienceWhere = {
      OR: [
        { groups: { some: { groupId: audience.groupId } } },
        { subgroups: { some: { subgroup: { groupId: audience.groupId } } } },
        { streamGroups: { some: { streamGroup: { entries: { some: { groupId: audience.groupId } } } } } }
      ]
    };
  } else if (audience.kind === "subgroup") {
    audienceWhere = {
      OR: [
        { subgroups: { some: { subgroupId: audience.subgroupId } } },
        { groups: { some: { groupId: audience.groupId } } },
        { streamGroups: { some: { streamGroup: { entries: { some: { groupId: audience.groupId } } } } } }
      ]
    };
  } else {
    audienceWhere = {
      OR: [
        { streamGroups: { some: { streamGroupId: audience.streamGroupId } } },
        { groups: { some: { groupId: { in: audience.groupIds } } } },
        { subgroups: { some: { subgroup: { groupId: { in: audience.groupIds } } } } },
        { streamGroups: { some: { streamGroup: { entries: { some: { groupId: { in: audience.groupIds } } } } } } }
      ]
    };
  }

  const audienceBusy = await prisma.lesson.findFirst({
    where: { ...slotWhere, ...audienceWhere },
    select: { id: true }
  });
  if (audienceBusy) {
    conflicts.push({
      type: "AUDIENCE_BUSY",
      withEntryId: audienceBusy.id,
      message: "Аудитория (группа/подгруппа/поток) занята в этот слот"
    });
  }

  return conflicts;
}

