import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { RoomTypeCreateSchema, RoomTypeUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud.js";

export async function roomTypesRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "room_types",
    model: prisma.roomType,
    createSchema: RoomTypeCreateSchema,
    updateSchema: RoomTypeUpdateSchema,
    listArgs: { search: { fields: ["name", "code"] } }
  });
}

