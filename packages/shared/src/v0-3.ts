import { z } from "zod";
import { PaginationQuerySchema } from "./pagination.js";

export const DayOfWeekSchema = z.coerce.number().int().min(1).max(7);

export const LessonCreateSchema = z
  .object({
    semesterId: z.string().uuid(),
    academicWeekId: z.string().uuid().optional(),
    dayOfWeek: DayOfWeekSchema,
    timeslotId: z.string().uuid(),
    subjectId: z.string().uuid(),
    lessonTypeId: z.string().uuid(),
    roomId: z.string().uuid().optional(),
    note: z.string().trim().min(1).max(500).optional(),
    teacherIds: z.array(z.string().uuid()).default([]),
    groupIds: z.array(z.string().uuid()).default([]),
    subgroupIds: z.array(z.string().uuid()).default([]),
    streamGroupIds: z.array(z.string().uuid()).default([])
  })
  .refine((x) => x.groupIds.length + x.subgroupIds.length + x.streamGroupIds.length > 0, {
    message: "At least one audience must be specified"
  });

export const LessonUpdateSchema = z
  .object({
    semesterId: z.string().uuid().optional(),
    academicWeekId: z.string().uuid().nullable().optional(),
    dayOfWeek: DayOfWeekSchema.optional(),
    timeslotId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
    lessonTypeId: z.string().uuid().optional(),
    roomId: z.string().uuid().nullable().optional(),
    note: z.string().trim().min(1).max(500).nullable().optional(),
    teacherIds: z.array(z.string().uuid()).optional(),
    groupIds: z.array(z.string().uuid()).optional(),
    subgroupIds: z.array(z.string().uuid()).optional(),
    streamGroupIds: z.array(z.string().uuid()).optional()
  })
  .refine(
    (x) => {
      if (x.groupIds || x.subgroupIds || x.streamGroupIds) {
        return (x.groupIds?.length ?? 0) + (x.subgroupIds?.length ?? 0) + (x.streamGroupIds?.length ?? 0) > 0;
      }
      return true;
    },
    { message: "At least one audience must be specified" }
  );

export const LessonsListQuerySchema = PaginationQuerySchema.extend({
  semesterId: z.string().uuid().optional(),
  academicWeekId: z.string().uuid().optional(),
  dayOfWeek: DayOfWeekSchema.optional(),
  timeslotId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional()
});

