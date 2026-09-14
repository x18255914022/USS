import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import jwt from "@fastify/jwt";

process.env.DATABASE_URL ??= "file:/tmp/uss-api-test.db";

const { authPlugin } = await import("../dist/plugins/auth.js");
const { rbacPlugin } = await import("../dist/plugins/rbac.js");
const { scheduleRoutes } = await import("../dist/routes/schedule.js");

test("iCal export requires auth", async () => {
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: "x".repeat(16) });
  authPlugin(app);
  rbacPlugin(app);
  await app.register(scheduleRoutes, { prefix: "/api/schedule" });
  await app.ready();

  const res = await app.inject({
    method: "GET",
    url: "/api/schedule/group/00000000-0000-0000-0000-000000000000/export?format=ical"
  });

  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).error, "UNAUTHORIZED");

  await app.close();
});

