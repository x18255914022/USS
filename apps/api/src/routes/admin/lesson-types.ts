import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { LessonTypeCreateSchema, LessonTypeUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud.js";

export async function lessonTypesRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "lesson_types",
    model: prisma.lessonType,
    createSchema: LessonTypeCreateSchema,
    updateSchema: LessonTypeUpdateSchema,
    listArgs: { search: { fields: ["name", "code", "color"] } }
  });
}

