import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { RoomsAvailabilityQuerySchema, RoomCreateSchema, RoomUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud.js";
import { conflictWeekTypes } from "../../lib/conflicts.js";

export async function roomsRoutes(app: FastifyInstance) {
  app.get(
    "/availability",
    { preHandler: [app.authenticate, app.authorize(["schedule:read"])] },
    async (request) => {
      const { dayOfWeek, timeslotId, semesterId, weekType, minCapacity, lessonTypeCode, buildingId } =
        RoomsAvailabilityQuerySchema.parse(request.query);

      const wts = conflictWeekTypes(weekType);
      const busy = await prisma.lesson.findMany({
        where: {
          semesterId,
          academicWeekId: null,
          dayOfWeek,
          timeslotId,
          weekType: { in: wts },
          roomId: { not: null }
        },
        include: {
          subject: { select: { code: true } },
          teachers: { include: { teacher: { include: { user: true } } } }
        }
      });

      const busyByRoomId = new Map<string, string>();
      for (const l of busy) {
        if (!l.roomId) continue;
        const teacher = (l.teachers as any[])[0]?.teacher?.user as any | undefined;
        const label = `${l.subject.code}${teacher ? ` · ${teacher.lastName}` : ""}`;
        if (!busyByRoomId.has(l.roomId)) busyByRoomId.set(l.roomId, label);
      }

      const rooms = await prisma.room.findMany({
        where: {
          isActive: true,
          ...(buildingId ? { buildingId } : {})
        },
        orderBy: { name: "asc" }
      });

      const items = rooms.map((r) => {
        const busyWith = busyByRoomId.get(r.id) ?? null;
        const available = !busyWith;
        const capacitySufficient = typeof minCapacity === "number" ? r.capacity >= minCapacity : true;
        const typeOk = lessonTypeCode === "lab" ? r.hasComputers : true;
        return {
          room: r,
          roomId: r.id,
          available,
          busyWith,
          capacitySufficient,
          typeOk
        };
      });

      const sorted = items.sort((a, b) => {
        const aa = Number(b.available) - Number(a.available);
        if (aa) return aa;
        const cc = Number(b.capacitySufficient) - Number(a.capacitySufficient);
        if (cc) return cc;
        const tt = Number(b.typeOk) - Number(a.typeOk);
        if (tt) return tt;
        return a.room.name.localeCompare(b.room.name);
      });

      return { items: sorted };
    }
  );

  registerCrudRoutes({
    app,
    permissionPrefix: "rooms",
    model: prisma.room,
    createSchema: RoomCreateSchema,
    updateSchema: RoomUpdateSchema,
    softDelete: true,
    listArgs: { search: { fields: ["name"] } }
  });
}
