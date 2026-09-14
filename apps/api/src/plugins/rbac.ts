import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";

declare module "fastify" {
  interface FastifyInstance {
    authorize: (required: string[]) => (request: any, reply: any) => Promise<void>;
  }
}

export function rbacPlugin(app: FastifyInstance) {
  app.decorate("authorize", (required: string[]) => {
    return async (request: any, reply: any) => {
      const userId = request.user?.sub as string | undefined;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } }
                }
              }
            }
          }
        }
      });

      if (!user || !user.isActive) return reply.status(403).send({ error: "FORBIDDEN" });

      const perms = new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code))
      );

      const ok = required.every((p) => perms.has(p));
      if (!ok) return reply.status(403).send({ error: "FORBIDDEN" });
    };
  });
}
