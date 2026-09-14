import { prisma } from "@repo/db";
import { WeekTypeSchema } from "@repo/shared";

export type BatchEntry = {
  id: string;
  semesterId: string;
  dayOfWeek: number;
  weekType: string;
  timeslotId: string;
  subjectId: string;
  lessonTypeId: string;
  teacherId: string;
  roomId: string;
  note: string | null;
  groupId?: string;
  subgroupId?: string;
  streamGroupId?: string;
};

export type BatchConflict = {
  type: "TEACHER_BUSY" | "ROOM_BUSY" | "AUDIENCE_BUSY" | "ROOM_CAPACITY" | "ROOM_TYPE";
  entryId: string;
  withEntryId?: string;
  message: string;
};

function weekOverlaps(a: string, b: string) {
  const aa = WeekTypeSchema.parse(a);
  const bb = WeekTypeSchema.parse(b);
  if (aa === "EVERY" || bb === "EVERY") return true;
  return aa === bb;
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function intersect(a: string[], b: string[]) {
  const set = new Set(a);
  return b.some((x) => set.has(x));
}

export async function validateBatch(entries: BatchEntry[]) {
  const conflicts: BatchConflict[] = [];

  const roomIds = uniq(entries.map((e) => e.roomId));
  const lessonTypeIds = uniq(entries.map((e) => e.lessonTypeId));
  const subgroupIds = uniq(entries.flatMap((e) => (e.subgroupId ? [e.subgroupId] : [])));
  const streamGroupIds = uniq(entries.flatMap((e) => (e.streamGroupId ? [e.streamGroupId] : [])));
  const groupIdsDirect = uniq(entries.flatMap((e) => (e.groupId ? [e.groupId] : [])));

  const rooms = await prisma.room.findMany({
    where: { id: { in: roomIds } },
    select: { id: true, capacity: true, hasComputers: true }
  });

  const lessonTypes = await prisma.lessonType.findMany({
    where: { id: { in: lessonTypeIds } },
    select: { id: true, code: true }
  });

  const subgroups = subgroupIds.length
    ? await prisma.subgroup.findMany({ where: { id: { in: subgroupIds } }, select: { id: true, groupId: true } })
    : [];

  const streamEntries = streamGroupIds.length
    ? await prisma.streamGroupEntry.findMany({
        where: { streamGroupId: { in: streamGroupIds } },
        select: { streamGroupId: true, groupId: true }
      })
    : [];

  const subgroupCounts = subgroupIds.length
    ? await prisma.student.groupBy({
        by: ["subgroupId"],
        where: { subgroupId: { in: subgroupIds } },
        _count: { _all: true }
      })
    : [];

  const roomById = new Map<string, (typeof rooms)[number]>(rooms.map((r) => [r.id, r] as const));
  const lessonTypeById = new Map<string, (typeof lessonTypes)[number]>(lessonTypes.map((lt) => [lt.id, lt] as const));
  const subgroupById = new Map<string, (typeof subgroups)[number]>(subgroups.map((s) => [s.id, s] as const));
  const streamGroupToGroups = new Map<string, string[]>();
  for (const se of streamEntries) {
    const arr = streamGroupToGroups.get(se.streamGroupId) ?? [];
    arr.push(se.groupId);
    streamGroupToGroups.set(se.streamGroupId, arr);
  }
  for (const [k, v] of streamGroupToGroups.entries()) streamGroupToGroups.set(k, uniq(v));

  const subgroupGroupIds = uniq(subgroups.map((s) => s.groupId));
  const streamGroupIdsAll = uniq(Array.from(streamGroupToGroups.values()).flat());
  const allGroupIds = uniq([...groupIdsDirect, ...subgroupGroupIds, ...streamGroupIdsAll]);

  const groupCounts = allGroupIds.length
    ? await prisma.student.groupBy({ by: ["groupId"], where: { groupId: { in: allGroupIds } }, _count: { _all: true } })
    : [];

  const groupSizeById = new Map<string, number>(groupCounts.map((g: any) => [g.groupId as string, g._count._all as number]));
  const subgroupSizeById = new Map<string, number>(subgroupCounts.map((g: any) => [g.subgroupId as string, g._count._all as number]));

  const groupIdsByEntryId = new Map<string, string[]>();
  const audienceSizeByEntryId = new Map<string, number>();

  for (const e of entries) {
    if (e.groupId) {
      groupIdsByEntryId.set(e.id, [e.groupId]);
      audienceSizeByEntryId.set(e.id, groupSizeById.get(e.groupId) ?? 0);
      continue;
    }
    if (e.subgroupId) {
      const sg = subgroupById.get(e.subgroupId);
      const gid = sg?.groupId;
      if (gid) groupIdsByEntryId.set(e.id, [gid]);
      audienceSizeByEntryId.set(e.id, subgroupSizeById.get(e.subgroupId) ?? 0);
      continue;
    }
    if (e.streamGroupId) {
      const gids = streamGroupToGroups.get(e.streamGroupId) ?? [];
      groupIdsByEntryId.set(e.id, gids);
      let total = 0;
      for (const gid of gids) total += groupSizeById.get(gid) ?? 0;
      audienceSizeByEntryId.set(e.id, total);
      continue;
    }
    groupIdsByEntryId.set(e.id, []);
    audienceSizeByEntryId.set(e.id, 0);
  }

  for (const e of entries) {
    const room = roomById.get(e.roomId);
    const size = audienceSizeByEntryId.get(e.id) ?? 0;
    if (room && size > 0 && room.capacity < size) {
      conflicts.push({
        type: "ROOM_CAPACITY",
        entryId: e.id,
        message: `Вместимость аудитории меньше размера группы (${room.capacity} < ${size})`
      });
    }

    const lt = lessonTypeById.get(e.lessonTypeId);
    if (lt?.code === "lab" && room && !room.hasComputers) {
      conflicts.push({
        type: "ROOM_TYPE",
        entryId: e.id,
        message: "Для лабораторной требуется аудитория с компьютерами"
      });
    }
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (a.semesterId !== b.semesterId) continue;
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (a.timeslotId !== b.timeslotId) continue;
      if (!weekOverlaps(a.weekType, b.weekType)) continue;

      if (a.teacherId === b.teacherId) {
        conflicts.push({
          type: "TEACHER_BUSY",
          entryId: a.id,
          withEntryId: b.id,
          message: "Преподаватель занят в этот слот"
        });
      }

      if (a.roomId === b.roomId) {
        conflicts.push({
          type: "ROOM_BUSY",
          entryId: a.id,
          withEntryId: b.id,
          message: "Аудитория занята в этот слот"
        });
      }

      const aGroups = groupIdsByEntryId.get(a.id) ?? [];
      const bGroups = groupIdsByEntryId.get(b.id) ?? [];
      if (aGroups.length && bGroups.length && intersect(aGroups, bGroups)) {
        conflicts.push({
          type: "AUDIENCE_BUSY",
          entryId: a.id,
          withEntryId: b.id,
          message: "Аудитория (группа/подгруппа/поток) занята в этот слот"
        });
      }
    }
  }

  return uniq(
    conflicts.map((c) => JSON.stringify([c.type, c.entryId, c.withEntryId ?? "", c.message]))
  ).map((x) => JSON.parse(x) as [BatchConflict["type"], string, string, string]).map(([type, entryId, withEntryId, message]) => ({
    type,
    entryId,
    withEntryId: withEntryId || undefined,
    message
  }));
}
