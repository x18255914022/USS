import { z } from "zod";
import { WeekTypeSchema } from "./v0-2.js";
import { DayOfWeekSchema } from "./v0-3.js";
import { ScheduleEntryCreateSchema, ScheduleEntryUpdateSchema } from "./v0-4.js";

export const ScheduleBatchCreateSchema = ScheduleEntryCreateSchema.and(
  z.object({
    clientId: z.string().trim().min(1).optional()
  })
);

export const ScheduleBatchUpdateSchema = ScheduleEntryUpdateSchema.and(
  z.object({
    id: z.string().uuid()
  })
);

export const ScheduleBatchDeleteSchema = z.object({
  id: z.string().uuid()
});

export const ScheduleBatchOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create"), data: ScheduleBatchCreateSchema }),
  z.object({ type: z.literal("update"), data: ScheduleBatchUpdateSchema }),
  z.object({ type: z.literal("delete"), data: ScheduleBatchDeleteSchema })
]);

export const ScheduleBatchSchema = z.object({
  ops: z.array(ScheduleBatchOperationSchema).min(1).max(500)
});

export const TeachersAvailabilityQuerySchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  timeslotId: z.string().uuid(),
  semesterId: z.string().uuid(),
  weekType: WeekTypeSchema,
  subjectId: z.string().uuid().optional()
});

export const RoomsAvailabilityQuerySchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  timeslotId: z.string().uuid(),
  semesterId: z.string().uuid(),
  weekType: WeekTypeSchema,
  minCapacity: z.coerce.number().int().min(0).optional(),
  lessonTypeCode: z.string().trim().min(1).optional(),
  buildingId: z.string().uuid().optional()
});
