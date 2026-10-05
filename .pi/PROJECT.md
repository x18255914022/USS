# Project Profile

This file is the project-specific source of truth for Pi prompts and skills.
Run `/project-init` from the repository root to replace this template with a verified profile.

## Purpose

USS — University Schedule System (v1.0, mostly done). Full-cycle university timetable: reference data (groups, teachers, subjects, rooms, semesters, timeslots), drag&drop schedule editor with conflict checks, student/teacher weekly views (even/odd weeks, date overrides), change requests (CANCEL/RESCHEDULE/EXTRA) with Telegram notifications, iCal export, Telegram bot. Roles: student, teacher, schedule manager, admin (RBAC at API level). Status (2026-10-05): v0.1–v0.9 complete (incl. Playwright E2E + UX polish); v1.0 mostly done — PostgreSQL migration, prod stack (`docker-compose.prod.yml`, Caddy proxy, multi-stage images, bot included, idempotent auto-seed), Swagger `/docs`; remaining: real domain/TLS run, image size optimization, rate limiting (pending Fastify 5). Docs in Russian.

## Architecture

Monorepo, pnpm workspaces + Turborepo:

- `apps/api` — Fastify 4 REST API, port 3001. Routes: `auth`, `schedule`, `changes`, `telegram`, `health`, `admin/*`. Services: `changeService`, `conflictService`, `scheduleBatch`, `settingsService`. JWT access+refresh, RBAC (Role/Permission tables), Bull Board at `/admin/queues`, seed script.
- `apps/web` — Next.js 16 App Router, port 3000. TanStack Query, Zustand, dnd-kit, Tailwind 4.
- `apps/bot` — grammy Telegram bot: schedule view, cancel requests, account linking by code. In-memory sessions. Needs `TELEGRAM_BOT_TOKEN`, otherwise exits with code 0.
- `apps/worker` — BullMQ worker: Telegram notifications, quiet hours, retry backoff. Exits 0 without token.
- `packages/db` — Prisma 6 schema (~34 models), PostgreSQL, migrations (single `init_postgres`), generated client; `scripts/run-prisma.mjs` runs prisma from repo root so root `.env` is read.
- `packages/shared` — Zod schemas, ioredis client, queue payload types.

Data flow: web/bot → API (JWT; bot uses `BOT_TOKEN` service token via `x-bot-token`) → Prisma/PostgreSQL; API → Redis (BullMQ) → worker → Telegram Bot API. Prod stack: `docker-compose.prod.yml` — proxy (Caddy, :80, HTTPS block commented), api, web, bot, worker, one-shot seed, postgres, redis.

## Stack

TypeScript (strict, `tsconfig.base.json`), Node 20+, pnpm 9 (`packageManager: pnpm@9.0.0`), Turborepo, Fastify 4 (+ @fastify/swagger at `/docs`), Prisma 6, Zod, BullMQ + ioredis + Redis 7, Next.js 16 / React 19, Tailwind 4, grammy, Prettier, vitest + node:test + Playwright (channel msedge — CDN unreachable).

## Workspace

| Package | Name | Role |
|---|---|---|
| `apps/api` | `@app/api` | REST API + seed |
| `apps/web` | `@app/web` | Web UI |
| `apps/bot` | `@app/bot` | Telegram bot (not in compose, run manually) |
| `apps/worker` | `@app/worker` | Notification worker |
| `packages/db` | `@repo/db` | Prisma schema, migrations, client |
| `packages/shared` | `@repo/shared` | Zod schemas, Redis client, queue types |

Root scripts fan out via turbo: `dev`, `build`, `lint`, `typecheck`; `format` = Prettier.

## Commands

| Purpose | Command | Scope | Notes |
|---|---|---|---|
| Install | `pnpm install` | root | No postinstall codegen — Prisma generate is manual |
| Prisma client | `pnpm --filter @repo/db prisma:generate` | db | After schema edits |
| Migrations | `pnpm --filter @repo/db prisma:migrate --name <x>` | db | Runs via `packages/db/scripts/run-prisma.mjs` (cwd=root so root `.env` is read). On fresh clone applies committed `init_postgres` without prompting; `--name` only for new migrations (no `--` separator) |
| Seed | `pnpm --filter @app/api seed` | api | Roles, users, demo data; builds first; idempotent (upserts) |
| Dev | `pnpm dev` | all | web+api+worker in parallel; web :3000, api :3001; needs `docker compose up -d postgres redis` first |
| E2E | `pnpm test:e2e` | root | Playwright (channel msedge); boots api+web itself, resets dev-БД (migrate reset --force); needs `.env` with ≥16-char secrets + postgres up |
| Bot | `pnpm --filter @app/bot dev` | bot | Requires `TELEGRAM_BOT_TOKEN` |
| Lint | `pnpm lint` | all | Only `apps/web` has real ESLint; others are `exit 0` stubs |
| Typecheck | `pnpm typecheck` | all | tsc strict, `--noEmit` |
| Unit tests | `pnpm --filter @app/api test:unit` | api | vitest |
| Integration tests | `pnpm --filter @app/api test:integration` | api | vitest; needs env per `vitest.integration.config.ts` |
| Worker tests | `pnpm --filter @app/worker test` | worker | node:test; **runs `pnpm build` first** |
| Build | `pnpm build` | all | tsc / next build |
| Format | `pnpm format` | root | Prettier; no `.prettierrc` — defaults |
| Containers (dev) | `docker compose up --build` | root | api, web, worker, postgres, redis (dev-mode; bot not in dev compose) |
| Containers (prod) | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` | root | proxy(Caddy)/api/web/bot/worker/seed/postgres/redis; multi-stage images; see docs/DEPLOYMENT.md «Продакшн» |

First use: `pnpm install` → `cp .env.example .env` (fix secrets ≥16 chars) → `docker compose up -d postgres redis` → `prisma:generate` → `prisma:migrate` → `seed` → `pnpm dev`. Health check: `curl http://localhost:3001/health`.

## Quality Gates

- `pnpm typecheck` — strict tsc across all packages (primary gate).
- `pnpm lint` — real ESLint only for `apps/web` (`eslint-config-next`); api/bot/worker/db/shared are stubs.
- `pnpm --filter @app/api test:unit && pnpm --filter @app/api test:integration` — vitest.
- `pnpm --filter @app/worker test` — node:test (quiet hours, backoff).
- `pnpm test:e2e` — Playwright happy path (needs postgres up + `.env` secrets ≥16 chars).
- `docker compose -f docker-compose.prod.yml config -q` — prod compose validity.
- No CI pipeline (no `.github`), no pre-commit hooks. Conventional Commits (`type(scope): subject`, scope = api/web/bot/worker/db/shared) and branch prefixes (`feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`) enforced by convention only. One PR = one change; no generated files in PRs.

## Architecture Rules

- Strict TypeScript; shared base `tsconfig.base.json`; exported functions declare return types (CONTRIBUTING).
- Shared Zod schemas live in `packages/shared`, not duplicated per app.
- All DB access through `packages/db` Prisma client; schema changes always ship with a migration.
- API shape: Fastify routes (`apps/api/src/routes`) stay thin; logic in `src/services`.
- Queue payloads typed via `packages/shared` queue types.
- Formatting by Prettier; never mix style-only and logic changes in one commit.
- Existing project conventions take precedence (Russian docs, Conventional Commits, pnpm filters).

## Data and APIs

- DB: PostgreSQL via Prisma 6 (`DATABASE_URL=postgresql://...`, dev compose creds `uss:uss_dev_password@localhost:5432/uss`), ~34 models — RBAC (User, Role, Permission, UserRole, RolePermission), directory (Faculty, Department, Building, Room, Subject, Group, Subgroup, Teacher, Student, Semester, AcademicWeek, TimeslotSet/Timeslot), schedule (Lesson + join tables), changes (ScheduleChange, SemesterSettings, ChangeNotification, NotificationPreference), Telegram linking (TelegramLinkCode), SystemSettings. Migration: single `init_postgres`; `prisma migrate deploy` used in prod seed container.
- API: REST `/api/*` on Fastify. Auth: JWT access (default TTL 900s) + refresh; RBAC middleware (approve/reject are `PATCH`). Bot→API via `x-bot-token` service token. iCal export via long-lived subscription token (365 days). CORS via `ALLOWED_ORIGINS`. Rate limiting currently disabled (`apps/api/src/server.ts`, pending Fastify 5).
- API docs: Swagger UI at `/docs`, spec at `/docs/json` (route listing + tags; no per-route JSON schemas — Zod in handlers).
- External: Telegram Bot API; Redis (BullMQ).

## Background Processing

BullMQ on Redis: notification queue produced by API, consumed by `apps/worker`; quiet hours (`UNIVERSITY_TZ`), retry backoff, Bull Board monitoring at `/admin/queues`. Worker and bot exit cleanly (code 0) without `TELEGRAM_BOT_TOKEN`. No cron/webhooks.

## Security Boundaries

- Never read, print, commit, or transmit real credentials, private keys, auth cookies, production DB dumps, or `.env` contents. Use `.env.example`, fake fixtures, placeholders only.
- Required secrets: `JWT_SECRET`, `REFRESH_TOKEN_SECRET` (≥16 chars), `APP_URL`; `BOT_TOKEN` must match between API and bot; `TELEGRAM_BOT_TOKEN` for bot/worker.
- Gitignored: `.env`, `.env.*` (except example), `*.pem`, `*.key`, `*.db`, `.pi/auth.json`, `.pi/sessions/`, `.pi/*.local.json`.
- Do not run destructive data, infrastructure, deployment, publish, commit, or push operations without explicit user approval.
- Known gaps (documented deviations): rate limiting disabled; bot sessions in-memory; no production images.

## Change Risk Matrix

| Change type | Risks | Required checks | Required skill |
|---|---|---|---|
| API route/service, auth, RBAC | Contract break, auth regression, bot/web breakage | `pnpm typecheck`, api unit+integration tests | `api-contract` |
| Prisma schema / migration | Data loss, migration drift (PostgreSQL), seed breakage | `prisma:generate`, `prisma:migrate`, reseed, api integration tests | `db-migration` |
| Queue payloads, worker logic | Stuck/duplicate notifications, backoff bugs | worker tests (note: builds first), manual queue check via Bull Board | `background-job` |
| `apps/web` UI/state | View regressions, dnd/state bugs | `pnpm lint`, `pnpm typecheck`, manual smoke of affected views | `frontend-change` |
| `packages/shared` schemas | Cross-app compile break across api/web/bot/worker | `pnpm typecheck` (turbo, all) | `safe-change` |
| Parallel/independent tasks | Merge conflicts on main | git-worktree isolation | `git-worktree` |

## Pi Model Routing

| Task | Model | Thinking | Use when |
|---|---|---|---|
| Discovery, architecture, ADR | `opencode-go/glm-5.3` | high | Repo analysis and cross-module planning |
| General backend and coding | `opencode-go/kimi-k2.7-code` | medium | Fastify/Prisma/BullMQ implementation and tests (default) |
| Complex bug, concurrency, review | `opencode-go/deepseek-v4-pro` | high | BullMQ/Redis races, auth bugs, hard refactor, review |
| Small read/search/docs changes | `opencode-go/glm-5.3-flash` | minimal | Narrow low-risk tasks |
| UI and component iteration | `opencode-go/minimax-m2.7` | low | `apps/web`: components, dnd editor, styles |
| Large unfamiliar codebase exploration | `opencode-go/kimi-k2.6` or `opencode-go/longcat-2.0` | medium | Broad read-only exploration |

## Enabled Skills

Core: repo-init, repo-discovery, model-routing, safe-change, test-strategy.
Domain (all apply to this repo): api-contract, db-migration, background-job, frontend-change, git-worktree.

## Open Questions

- `.opencode/____opencode.json` — underscore-prefixed filename: is opencode config intentionally disabled? (AGENTS.md still documents `.opencode/agents/`.)
- `.prettierrc` missing while CONTRIBUTING.md references it — intentional Prettier defaults, or doc drift?
- 23 pre-existing lint errors in `apps/web` (mostly `any`) — separate cleanup task.
- Rate limiting stays off until Fastify 5 upgrade; prod images ~1.1GB (pnpm prune no-op in workspaces) — v1.1 candidates.
- Playwright uses `channel: "msedge"` (CDN unreachable); swap to chromium when network allows.
- No CI pipeline — quality gates run manually only.
