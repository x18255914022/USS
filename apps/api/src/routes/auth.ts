import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { LoginBodySchema, RegisterBodySchema } from "@repo/shared";
import { z } from "zod";
import { env } from "../env.js";
import { hashLinkCode } from "../lib/telegramLink.js";

// Token TTL from environment or defaults
const ACCESS_TTL_SEC = env.ACCESS_TOKEN_TTL;
const REFRESH_TTL_SEC = env.REFRESH_TOKEN_TTL;

const LinkTelegramBodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  telegramChatId: z.string().trim().min(1).max(32).optional()
});

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/api/auth/refresh",
    maxAge: REFRESH_TTL_SEC,
    secure: env.NODE_ENV === "production"
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const body = RegisterBodySchema.parse(request.body);

    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return reply.status(409).send({ error: "EMAIL_TAKEN" });

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName
      }
    });

    const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: ACCESS_TTL_SEC, key: env.JWT_SECRET });
    const refreshToken = app.jwt.sign(
      { sub: user.id },
      { expiresIn: REFRESH_TTL_SEC, key: env.REFRESH_TOKEN_SECRET }
    );

    reply.setCookie("refreshToken", refreshToken, refreshCookieOptions());
    return reply.send({ accessToken });
  });

  app.post("/login", async (request, reply) => {
    const body = LoginBodySchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) return reply.status(401).send({ error: "INVALID_CREDENTIALS" });

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return reply.status(401).send({ error: "INVALID_CREDENTIALS" });

    const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: ACCESS_TTL_SEC, key: env.JWT_SECRET });
    const refreshToken = app.jwt.sign(
      { sub: user.id },
      { expiresIn: REFRESH_TTL_SEC, key: env.REFRESH_TOKEN_SECRET }
    );

    reply.setCookie("refreshToken", refreshToken, refreshCookieOptions());
    return reply.send({ accessToken });
  });

  app.post("/refresh", async (request, reply) => {
    const token = request.cookies.refreshToken as string | undefined;
    if (!token) return reply.status(401).send({ error: "UNAUTHORIZED" });

    try {
      const payload = await app.jwt.verify<{ sub: string }>(token, { key: env.REFRESH_TOKEN_SECRET });
      const accessToken = app.jwt.sign({ sub: payload.sub }, { expiresIn: ACCESS_TTL_SEC, key: env.JWT_SECRET });
      return reply.send({ accessToken });
    } catch {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request: any) => {
    const userId = request.user.sub as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        telegramChatId: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                permissions: { select: { permission: { select: { code: true } } } }
              }
            }
          }
        }
      }
    });
    if (!user || !user.isActive) return { user: null };

    const roles = user.roles.map((x) => x.role.code);
    const permissions = Array.from(
      new Set(user.roles.flatMap((x) => x.role.permissions.map((rp) => rp.permission.code)))
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        telegramChatId: user.telegramChatId,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions
      }
    };
  });

  app.post("/link-telegram", { preHandler: [app.authenticate] }, async (request: any, reply) => {
    const userId = request.user?.sub as string | undefined;
    if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const body = LinkTelegramBodySchema.parse(request.body);
    const codeHash = hashLinkCode({ code: body.code, secret: env.JWT_SECRET });

    const row = await prisma.telegramLinkCode.findUnique({ where: { codeHash } });
    if (!row) return reply.status(404).send({ error: "NOT_FOUND" });
    if (row.consumedAt) return reply.status(409).send({ error: "ALREADY_USED" });
    if (row.expiresAt.getTime() <= Date.now()) return reply.status(410).send({ error: "EXPIRED" });
    if (body.telegramChatId && body.telegramChatId !== row.telegramChatId) return reply.status(400).send({ error: "INVALID_CHAT" });

    const telegramChatId = body.telegramChatId ?? row.telegramChatId;

    const res = await prisma
      .$transaction(async (tx) => {
        const updated = await tx.user.update({ where: { id: userId }, data: { telegramChatId } }).catch(() => null);
        if (!updated) return "NOT_FOUND" as const;
        await tx.telegramLinkCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
        return "OK" as const;
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes("Unique constraint failed")) return "CHAT_ALREADY_LINKED" as const;
        throw err;
      });

    if (res === "NOT_FOUND") return reply.status(404).send({ error: "NOT_FOUND" });
    if (res === "CHAT_ALREADY_LINKED") return reply.status(409).send({ error: "CHAT_ALREADY_LINKED" });

    return { ok: true, telegramChatId };
  });
}
