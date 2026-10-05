#!/usr/bin/env node
// Прокси к prisma CLI, запускаемый из корня репозитория: prisma читает .env из cwd,
// а pnpm run выполняет скрипты в packages/db, где корневой .env не виден
// (та же логика загрузки .env, что и в apps/api/src/env.ts).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const result = spawnSync("pnpm", ["exec", "prisma", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32"
});
process.exit(result.status ?? 1);
