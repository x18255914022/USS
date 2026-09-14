import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { DepartmentCreateSchema, DepartmentUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud.js";

export async function departmentsRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "departments",
    model: prisma.department,
    createSchema: DepartmentCreateSchema,
    updateSchema: DepartmentUpdateSchema,
    listArgs: { search: { fields: ["name", "code"] } }
  });
}

