import { z } from "zod";

export const ChangeTypeSchema = z.enum(["CANCEL", "REPLACE_ROOM", "REPLACE_TEACHER", "RESCHEDULE", "EXTRA"]);
export const ChangeStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "REVOKED"]);

export const ChangeCreateCancelSchema = z.object({
  type: z.literal("CANCEL"),
  lessonId: z.string().uuid(),
  date: z.coerce.date(),
  reason: z.string().trim().min(1).max(500).optional()
});

export const ChangeCreateReplaceRoomSchema = z.object({
  type: z.literal("REPLACE_ROOM"),
  lessonId: z.string().uuid(),
  date: z.coerce.date(),
  newRoomId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500).optional()
});

export const ChangeCreateRescheduleSchema = z.object({
  type: z.literal("RESCHEDULE"),
  lessonId: z.string().uuid(),
  date: z.coerce.date(),
  newDate: z.coerce.date(),
  newTimeslotId: z.string().uuid().optional(),
  newRoomId: z.string().uuid().optional(),
  newTeacherId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(500).optional()
});

export const ChangeCreateExtraSchema = z
  .object({
    type: z.literal("EXTRA"),
    semesterId: z.string().uuid(),
    date: z.coerce.date(),
    timeslotId: z.string().uuid(),
    subjectId: z.string().uuid(),
    lessonTypeId: z.string().uuid(),
    teacherId: z.string().uuid(),
    roomId: z.string().uuid(),
    groupId: z.string().uuid().optional(),
    subgroupId: z.string().uuid().optional(),
    streamGroupId: z.string().uuid().optional(),
    reason: z.string().trim().min(1).max(500).optional()
  });

export const ChangeCreateSchema = z.discriminatedUnion("type", [
  ChangeCreateCancelSchema,
  ChangeCreateReplaceRoomSchema,
  ChangeCreateRescheduleSchema,
  ChangeCreateExtraSchema
]);

export const ChangesListQuerySchema = z.object({
  status: ChangeStatusSchema.optional(),
  type: ChangeTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export const ChangeRejectBodySchema = z.object({
  comment: z.string().trim().min(1).max(500)
});

export const SystemSettingsSchema = z.object({
  minCancelHours: z.coerce.number().int().min(0),
  autoApproveReplaceRoom: z.coerce.boolean()
});

export const SystemSettingsUpdateSchema = SystemSettingsSchema.partial();

export const SemesterSettingsUpdateSchema = z.object({
  minCancelHours: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  autoApproveReplaceRoom: z.union([z.coerce.boolean(), z.null()]).optional()
});
