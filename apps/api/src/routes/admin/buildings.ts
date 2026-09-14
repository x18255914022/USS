import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { BuildingCreateSchema, BuildingUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud.js";

export async function buildingsRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "buildings",
    model: prisma.building,
    createSchema: BuildingCreateSchema,
    updateSchema: BuildingUpdateSchema,
    listArgs: { search: { fields: ["name", "code", "address"] } }
  });
}

