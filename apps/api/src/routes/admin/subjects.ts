import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { SubjectCreateSchema, SubjectUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud.js";

export async function subjectsRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "subjects",
    model: prisma.subject,
    createSchema: SubjectCreateSchema,
    updateSchema: SubjectUpdateSchema,
    listArgs: { search: { fields: ["name", "code"] } }
  });
}

