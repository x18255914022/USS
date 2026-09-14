import { z } from "zod";
import { PaginationQuerySchema } from "./pagination.js";
import { WeekTypeSchema } from "./v0-2.js";
import { DayOfWeekSchema } from "./v0-3.js";

export const ScheduleEntryCreateSchema = z
  .object({
    semesterId: z.string().uuid(),
    dayOfWeek: DayOfWeekSchema,
    weekType: WeekTypeSchema.default("EVERY"),
    timeslotId: z.string().uuid(),
    subjectId: z.string().uuid(),
    lessonTypeId: z.string().uuid(),
    teacherId: z.string().uuid(),
    roomId: z.string().uuid(),
    note: z.string().trim().min(1).max(500).optional(),
    groupId: z.string().uuid().optional(),
    subgroupId: z.string().uuid().optional(),
    streamGroupId: z.string().uuid().optional()
  })
  .refine(
    (x) => Number(Boolean(x.groupId)) + Number(Boolean(x.subgroupId)) + Number(Boolean(x.streamGroupId)) === 1,
    { message: "Exactly one audience must be specified" }
  );

export const ScheduleEntryUpdateSchema = z
  .object({
    dayOfWeek: DayOfWeekSchema.optional(),
    weekType: WeekTypeSchema.optional(),
    timeslotId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    lessonTypeId: z.string().uuid().optional(),
    teacherId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    note: z.string().trim().min(1).max(500).nullable().optional(),
    groupId: z.string().uuid().optional(),
    subgroupId: z.string().uuid().optional(),
    streamGroupId: z.string().uuid().optional()
  })
  .refine(
    (x) => {
      if (x.groupId || x.subgroupId || x.streamGroupId) {
        return Number(Boolean(x.groupId)) + Number(Boolean(x.subgroupId)) + Number(Boolean(x.streamGroupId)) === 1;
      }
      return true;
    },
    { message: "Exactly one audience must be specified" }
  );

export const ScheduleEntriesListQuerySchema = PaginationQuerySchema.extend({
  semesterId: z.string().uuid(),
  groupId: z.string().uuid()
});

export const ScheduleConflictsQuerySchema = PaginationQuerySchema.extend({
  semesterId: z.string().uuid(),
  groupId: z.string().uuid()
});

export const ScheduleDateQuerySchema = z.object({
  date: z.coerce.date().optional()
});

