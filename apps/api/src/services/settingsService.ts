import { prisma, type Prisma, type PrismaClient } from "@repo/db";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getSystemSettings(db: DbClient = prisma) {
  return db.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default", minCancelHours: 2, autoApproveReplaceRoom: true },
    update: {}
  });
}

export async function getSettingsForSemester(db: DbClient, semesterId: string) {
  const global = await getSystemSettings(db);
  const overrides = await db.semesterSettings.findUnique({ where: { semesterId } });
  return {
    minCancelHours: overrides?.minCancelHours ?? global.minCancelHours,
    autoApproveReplaceRoom: overrides?.autoApproveReplaceRoom ?? global.autoApproveReplaceRoom,
    global,
    overrides
  };
}
