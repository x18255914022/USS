import { prisma } from "@repo/db";
import { WeekTypeSchema } from "@repo/shared";

/**
 * Resolve semester and week for a given date
 * Returns the active semester containing the date, or the most recent active semester
 */
export async function resolveSemesterAndWeek(date: Date) {
  const semester =
    (await prisma.semester.findFirst({
      where: { startDate: { lte: date }, endDate: { gte: date } },
      orderBy: { isActive: "desc" }
    })) ?? (await prisma.semester.findFirst({ orderBy: { isActive: "desc" } }));

  if (!semester) return null;

  const week = await prisma.academicWeek.findFirst({
    where: { semesterId: semester.id, startDate: { lte: date }, isActive: true },
    orderBy: { startDate: "desc" }
  });

  const weekType = WeekTypeSchema.safeParse(week?.weekType).success ? (week!.weekType as string) : "EVERY";
  return { semester, week, weekType: WeekTypeSchema.parse(weekType) };
}

/**
 * Resolve timeslots for a semester (from default timeslot set)
 */
export async function resolveTimeslots(semesterId: string) {
  const set = await prisma.timeslotSet.findFirst({
    where: { semesterId, isDefault: true },
    include: { timeslots: { orderBy: { number: "asc" } } }
  });
  return set?.timeslots ?? [];
}

/**
 * Build where clause for lesson week filtering
 */
export function lessonWeekWhere(week: { id: string } | null, weekType: string) {
  const wts = [weekType, "EVERY"];
  const parsed = wts.map((x) => WeekTypeSchema.parse(x));

  return {
    OR: [
      ...(week ? [{ academicWeekId: week.id }] : []),
      { academicWeekId: null, weekType: { in: parsed } }
    ]
  };
}

/**
 * Build where clause for group audience (groups, subgroups, stream groups)
 */
export function groupAudienceWhere(groupId: string) {
  return {
    OR: [
      { groups: { some: { groupId } } },
      { subgroups: { some: { subgroup: { groupId } } } },
      { streamGroups: { some: { streamGroup: { entries: { some: { groupId } } } } } }
    ]
  };
}

/**
 * Build where clause for "me" audience (student perspective)
 */
export function meAudienceWhere(student: { groupId: string; subgroupId: string | null }) {
  return {
    OR: [
      { groups: { some: { groupId: student.groupId } } },
      ...(student.subgroupId ? [{ subgroups: { some: { subgroupId: student.subgroupId } } }] : []),
      { streamGroups: { some: { streamGroup: { entries: { some: { groupId: student.groupId } } } } } }
    ]
  };
}

/**
 * Convert ISO day of week (1-7, where 1 is Monday, 7 is Sunday)
 */
export function isoDow(d: Date): number {
  const n = d.getUTCDay();
  return n === 0 ? 7 : n;
}

/**
 * Standard include for schedule entries
 */
export const scheduleEntryInclude = {
  timeslot: { include: { timeslotSet: true } },
  subject: true,
  lessonType: true,
  room: true,
  teachers: { include: { teacher: { include: { user: true } } } },
  groups: { include: { group: true } },
  subgroups: { include: { subgroup: { include: { group: true } } } },
  streamGroups: { include: { streamGroup: true } }
} as const;

/**
 * Type for schedule entry with includes
 */
export type ScheduleEntryWithIncludes = {
  id: string;
  dayOfWeek: number;
  weekType: string;
  timeslotId: string;
  timeslot: {
    id: string;
    number: number;
    startTime: string;
    endTime: string;
    timeslotSet?: { id: string; name: string };
  };
  subject: { id: string; code: string; name: string };
  lessonType: { id: string; name: string; code?: string };
  roomId: string | null;
  room: { id: string; name: string; capacity?: number; hasComputers?: boolean } | null;
  teachers: Array<{
    teacher: {
      id: string;
      user: { id: string; firstName: string; lastName: string; email: string };
    };
  }>;
  groups: Array<{ group: { id: string; name: string } }>;
  subgroups: Array<{ subgroup: { id: string; name: string; group: { id: string; name: string } } }>;
  streamGroups: Array<{ streamGroup: { id: string; name: string } }>;
  note?: string | null;
  createdAt?: Date;
};
