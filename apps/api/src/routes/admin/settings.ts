import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { SystemSettingsUpdateSchema } from "@repo/shared";
import { getSystemSettings } from "../../services/settingsService.js";

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate, app.authorize(["settings:read"])] }, async () => {
    const item = await getSystemSettings(prisma);
    return { item };
  });

  app.patch("/", { preHandler: [app.authenticate, app.authorize(["settings:write"])] }, async (request: any) => {
    const body = SystemSettingsUpdateSchema.parse(request.body);
    const item = await prisma.systemSettings.upsert({
      where: { id: "default" },
      create: { id: "default", minCancelHours: body.minCancelHours ?? 2, autoApproveReplaceRoom: body.autoApproveReplaceRoom ?? true },
      update: {
        ...(typeof body.minCancelHours === "number" ? { minCancelHours: body.minCancelHours } : {}),
        ...(typeof body.autoApproveReplaceRoom === "boolean" ? { autoApproveReplaceRoom: body.autoApproveReplaceRoom } : {})
      }
    });
    return { item };
  });
}

