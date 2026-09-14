import { z } from "zod";

export const FacultyCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50)
});

export const FacultyUpdateSchema = FacultyCreateSchema.partial();

export const DepartmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  facultyId: z.string().uuid()
});

export const DepartmentUpdateSchema = DepartmentCreateSchema.partial();

export const BuildingCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  address: z.string().trim().min(1).max(300)
});

export const BuildingUpdateSchema = BuildingCreateSchema.partial();

export const RoomTypeCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50)
});

export const RoomTypeUpdateSchema = RoomTypeCreateSchema.partial();

export const RoomCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  buildingId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  capacity: z.coerce.number().int().min(0).max(10000),
  floor: z.coerce.number().int().min(-20).max(200).optional(),
  hasProjector: z.coerce.boolean().default(false),
  hasComputers: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export const RoomUpdateSchema = RoomCreateSchema.partial();

export const SubjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50)
});

export const SubjectUpdateSchema = SubjectCreateSchema.partial();

export const LessonTypeCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/)
});

export const LessonTypeUpdateSchema = LessonTypeCreateSchema.partial();
