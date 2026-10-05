import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Playwright globalSetup: reset the PostgreSQL DB, apply migrations, seed demo
 * data, and ensure an "E2E Осень 2026" semester covering the current date.
 *
 * Prerequisite: `docker compose up -d postgres redis` (something must already
 * serve localhost:5432 with the dev compose creds; prisma fails with a clear
 * connection error otherwise). Redis is only needed by the telegram worker —
 * the tested flow works without it.
 *
 * Why the extra semester: seed data hardcodes "Весна 2026" (2026-02-01..2026-06-30).
 * CANCEL changes must be >= minCancelHours (2h) in the future, but a date past
 * 2026-06-30 resolves to the fallback week (2026-06-01..06-07), so a future cancel
 * would never appear in any student's week. The E2E semester covers "now" and has
 * no academic weeks, so weekType resolves to EVERY and the requested date's own
 * week is used (see resolveSemesterAndWeek in apps/api/src/lib/scheduleUtils.ts).
 */

const DEFAULT_DB_URL = "postgresql://uss:uss_dev_password@localhost:5432/uss";

function findWorkspaceRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir)
      throw new Error("pnpm-workspace.yaml not found above " + start);
    dir = parent;
  }
}

const root = findWorkspaceRoot(process.cwd());

function run(cmd: string, env: Record<string, string> = {}) {
  execSync(cmd, {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, ...env },
  });
}

// On Windows the generated query-engine DLL is locked by any running API server
// (reuseExistingServer), making `prisma generate` fail with EPERM even though the
// client is already generated. A failed generate is only fatal if the client is missing.
function runGenerate() {
  try {
    run(
      "pnpm --filter @repo/db exec prisma generate --schema prisma/schema.prisma",
      {
        DATABASE_URL: process.env.DATABASE_URL ?? DEFAULT_DB_URL,
      },
    );
  } catch (err) {
    const probe = path.join(
      root,
      "packages",
      "db",
      "node_modules",
      "@prisma",
      "client",
      "index.js",
    );
    if (!fs.existsSync(probe)) throw err;
    console.warn(
      "global-setup: prisma generate failed (DLL locked by a running server) — client already generated, continuing",
    );
  }
}

/** Validate the root .env (API + webServers read it too). Returns DATABASE_URL. */
function ensureEnvFile(): string {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath))
    fs.copyFileSync(path.join(root, ".env.example"), envPath);

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  const value = (key: string) =>
    lines.find((l) => l.startsWith(`${key}="`))?.slice(key.length + 2, -1) ??
    "";
  const set = (key: string, val: string) => {
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    lines[i >= 0 ? i : lines.length] = `${key}="${val}"`;
  };

  let changed = false;
  // .env.example ships 9-char secrets; the API env schema requires >= 16.
  const secrets: [string, string][] = [
    ["JWT_SECRET", "e2e_local_secret_0123456789"],
    ["REFRESH_TOKEN_SECRET", "e2e_local_refresh_0123456789"],
    ["BOT_TOKEN", "change_me_change_me"],
    ["TELEGRAM_BOT_TOKEN", "change_me_change_me"],
  ];
  for (const [key, val] of secrets) {
    if (value(key).length < 16) {
      set(key, val);
      changed = true;
    }
  }
  // v1.0 is PostgreSQL; a leftover SQLite file: URL would fail schema validation.
  let dbUrl = value("DATABASE_URL");
  if (!dbUrl.startsWith("postgres")) {
    dbUrl = DEFAULT_DB_URL;
    set("DATABASE_URL", dbUrl);
    changed = true;
  }
  if (changed) fs.writeFileSync(envPath, lines.join("\n") + "\n");
  return dbUrl;
}

async function ensureE2eSemester() {
  // @prisma/client lives in packages/db, not at the workspace root;
  // the generated client reads DATABASE_URL from process.env at runtime.
  const req = createRequire(path.join(root, "packages", "db", "package.json"));
  const { PrismaClient } = req("@prisma/client");
  const prisma = new PrismaClient();

  const DAY = 86400000;
  const startDate = new Date(Date.now() - 7 * DAY);
  const endDate = new Date(Date.now() + 60 * DAY);

  await prisma.semester.updateMany({ data: { isActive: false } });
  const semester = await prisma.semester.upsert({
    where: { name: "E2E Осень 2026" },
    create: { name: "E2E Осень 2026", startDate, endDate, isActive: true },
    update: { startDate, endDate, isActive: true },
  });
  const set = await prisma.timeslotSet.upsert({
    where: { semesterId_name: { semesterId: semester.id, name: "Основной" } },
    create: { semesterId: semester.id, name: "Основной", isDefault: true },
    update: { isDefault: true },
  });
  const slots = [
    { number: 1, startTime: "09:00", endTime: "10:30" },
    { number: 2, startTime: "10:40", endTime: "12:10" },
    { number: 3, startTime: "12:50", endTime: "14:20" },
    { number: 4, startTime: "14:30", endTime: "16:00" },
    { number: 5, startTime: "16:10", endTime: "17:40" },
    { number: 6, startTime: "17:50", endTime: "19:20" },
  ];
  for (const t of slots) {
    await prisma.timeslot.upsert({
      where: {
        timeslotSetId_number: { timeslotSetId: set.id, number: t.number },
      },
      create: { timeslotSetId: set.id, ...t },
      update: { startTime: t.startTime, endTime: t.endTime },
    });
  }
  await prisma.$disconnect();
  console.log(`global-setup: E2E semester ready (${semester.id})`);
}

export default async function globalSetup() {
  const dbUrl = ensureEnvFile();
  process.env.DATABASE_URL = dbUrl;

  // Deterministic run: drop data, reapply migrations, then the README runbook steps.
  runGenerate();
  run(
    "pnpm --filter @repo/db exec prisma migrate reset --schema prisma/schema.prisma --force --skip-generate",
    {
      DATABASE_URL: dbUrl,
    },
  );
  // apps/api seed runs `tsc` first, which needs workspace package dist/ builds.
  run("pnpm --filter @repo/db --filter @repo/shared build");
  run("pnpm --filter @app/api seed");

  await ensureE2eSemester();
}
