import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { FacultyCreateSchema, FacultyUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud.js";

export async function facultiesRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "faculties",
    model: prisma.faculty,
    createSchema: FacultyCreateSchema,
    updateSchema: FacultyUpdateSchema,
    listArgs: { search: { fields: ["name", "code"] } }
  });
}

