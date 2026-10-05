import { expect, test } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { authPlugin } from "../../../src/plugins/auth.js";
import { rbacPlugin } from "../../../src/plugins/rbac.js";
import { scheduleRoutes } from "../../../src/routes/schedule.js";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/uss";

test("GET /api/schedule/group/:id/export требует авторизацию", async () => {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: "x".repeat(16) });
  authPlugin(app as any);
  rbacPlugin(app as any);
  await app.register(scheduleRoutes as any, { prefix: "/api/schedule" });
  await app.ready();

  const res = await app.inject({
    method: "GET",
    url: "/api/schedule/group/00000000-0000-0000-0000-000000000000/export?format=ical"
  });

  expect(res.statusCode).toBe(401);
  expect(JSON.parse(res.body).error).toBe("UNAUTHORIZED");

  await app.close();
});

