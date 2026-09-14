import { z } from "zod";

export const WeekTypeSchema = z.enum(["EVERY", "UPPER", "LOWER"]);

export const GroupCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  course: z.coerce.number().int().min(1).max(10),
  facultyId: z.string().uuid(),
  subgroupCount: z.coerce.number().int().min(0).max(20).default(0)
});

export const GroupUpdateSchema = GroupCreateSchema.omit({ subgroupCount: true }).partial();

export const StreamGroupCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  groupIds: z.array(z.string().uuid()).default([])
});

export const StreamGroupUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  groupIds: z.array(z.string().uuid()).optional()
});

export const SemesterCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
});

export const SemesterUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.coerce.boolean().optional()
});

export const AcademicWeeksBulkPatchSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      weekType: WeekTypeSchema,
      isActive: z.coerce.boolean()
    })
  )
});

export const TimeslotSchema = z.object({
  number: z.coerce.number().int().min(1).max(20),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/)
});

export const TimeslotSetCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isDefault: z.coerce.boolean().default(false),
  timeslots: z.array(TimeslotSchema).min(1).max(20)
});

export const TimeslotSetUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  isDefault: z.coerce.boolean().optional(),
  timeslots: z.array(TimeslotSchema).min(1).max(20).optional()
});

export const AdminUserCreateSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  isActive: z.coerce.boolean().default(true),
  roleCodes: z.array(z.string().trim().min(1)).min(1),
  student: z
    .object({
      groupId: z.string().uuid(),
      subgroupId: z.string().uuid().optional()
    })
    .optional(),
  teacher: z
    .object({
      departmentId: z.string().uuid(),
      position: z.string().trim().min(1).max(100).optional()
    })
    .optional()
});

export const AdminUserUpdateSchema = z.object({
  email: z.string().email().toLowerCase().optional(),
  password: z.string().min(8).max(72).optional(),
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  isActive: z.coerce.boolean().optional(),
  roleCodes: z.array(z.string().trim().min(1)).min(1).optional(),
  student: z
    .object({
      groupId: z.string().uuid(),
      subgroupId: z.string().uuid().optional()
    })
    .optional(),
  teacher: z
    .object({
      departmentId: z.string().uuid(),
      position: z.string().trim().min(1).max(100).optional()
    })
    .optional()
});
