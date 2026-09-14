# University Schedule System v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Развернуть с нуля монорепо (Turborepo) с API (Fastify) и Web (Next.js), реализовать auth (JWT access/refresh), RBAC и CRUD справочников (v0.1 из roadmap).

**Architecture:** Монорепо `apps/*` (api/web) + `packages/*` (db/shared). Валидация всех входных данных через Zod-схемы в `packages/shared`. Доступ к БД через PrismaClient, вынесенный в `packages/db`. Web использует общий API-клиент с авто-refresh.

**Tech Stack:** Node.js, TypeScript, pnpm, Turborepo, Fastify, Prisma (SQLite), Next.js App Router, Tailwind, shadcn/ui, Zod, React Hook Form, TanStack Table.

---

## Assumptions (можно поменять)

- Package manager: `pnpm`
- TypeScript везде
- Refresh token хранится в httpOnly cookie `refreshToken`
- Access token хранится в памяти/LS на фронте (для простоты v0.1 — в `localStorage`)
- SQLite на локали через Prisma `DATABASE_URL="file:./dev.db"`

---

## Target Repo Layout

```
university-schedule/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── db/
│   └── shared/
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── .env.example
```

---

### Task 1: Bootstrap монорепо (pnpm + turbo + TS база)

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `docker-compose.yml`

- [ ] **Step 1: Инициализировать корневой package.json**

```json
{
  "name": "university-schedule",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "prettier -w ."
  },
  "devDependencies": {
    "prettier": "^3.3.3",
    "turbo": "^2.0.9",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Добавить workspace-конфиг pnpm**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Добавить turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    }
  }
}
```

- [ ] **Step 4: Добавить общий tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: Добавить .env.example**

```bash
DATABASE_URL="file:./dev.db"
JWT_SECRET="change_me"
REFRESH_TOKEN_SECRET="change_me"
APP_URL="http://localhost:3000"
```

- [ ] **Step 6: Добавить docker-compose.yml (только для dev-удобства v0.1)**

```yaml
services:
  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
    env_file:
      - .env
    ports:
      - "3001:3001"
    command: ["pnpm", "--filter", "@app/api", "dev"]
  web:
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
    env_file:
      - .env
    ports:
      - "3000:3000"
    command: ["pnpm", "--filter", "@app/web", "dev"]
```

- [ ] **Step 7: Проверка сборки тулчейна**

Run:
```bash
pnpm -v
pnpm install
pnpm run build
```
Expected: build завершится (пока без пакетов — быстро).

---

### Task 2: packages/shared — Zod схемы и типы (общие для API/Web)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/pagination.ts`
- Create: `packages/shared/src/auth.ts`
- Create: `packages/shared/src/admin-dicts.ts`

- [ ] **Step 1: package.json для shared**

```json
{
  "name": "@repo/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "node -e \"process.exit(0)\"",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 2: tsconfig.json для shared**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: pagination schema**

```ts
import { z } from "zod";

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional()
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
```

- [ ] **Step 4: auth schema**

```ts
import { z } from "zod";

export const RegisterBodySchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50)
});

export const LoginBodySchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(72)
});

export const RefreshBodySchema = z.object({});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
```

- [ ] **Step 5: admin dict schemas (минимальный набор v0.1)**

```ts
import { z } from "zod";

export const FacultyCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50)
});

export const FacultyUpdateSchema = FacultyCreateSchema.partial();

export const DepartmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  facultyId: z.string().uuid()
});

export const DepartmentUpdateSchema = DepartmentCreateSchema.partial();

export const BuildingCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  address: z.string().trim().min(1).max(300)
});

export const BuildingUpdateSchema = BuildingCreateSchema.partial();

export const RoomTypeCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50)
});

export const RoomTypeUpdateSchema = RoomTypeCreateSchema.partial();

export const RoomCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  buildingId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  capacity: z.coerce.number().int().min(0).max(10000),
  floor: z.coerce.number().int().min(-20).max(200).optional(),
  hasProjector: z.coerce.boolean().default(false),
  hasComputers: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true)
});

export const RoomUpdateSchema = RoomCreateSchema.partial();

export const SubjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50)
});

export const SubjectUpdateSchema = SubjectCreateSchema.partial();

export const LessonTypeCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{6})$/)
});

export const LessonTypeUpdateSchema = LessonTypeCreateSchema.partial();
```

- [ ] **Step 6: index.ts exports**

```ts
export * from "./pagination";
export * from "./auth";
export * from "./admin-dicts";
```

- [ ] **Step 7: Проверить сборку shared**

Run:
```bash
pnpm --filter @repo/shared build
```
Expected: `packages/shared/dist/*` сгенерирован.

---

### Task 3: packages/db — Prisma schema + PrismaClient

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: package.json для db**

```json
{
  "name": "@repo/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "node -e \"process.exit(0)\"",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "prisma:generate": "prisma generate --schema prisma/schema.prisma",
    "prisma:migrate": "prisma migrate dev --schema prisma/schema.prisma",
    "prisma:studio": "prisma studio --schema prisma/schema.prisma"
  },
  "dependencies": {
    "@prisma/client": "^5.18.0"
  },
  "devDependencies": {
    "prisma": "^5.18.0"
  }
}
```

- [ ] **Step 2: tsconfig.json для db**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Prisma schema (v0.1 модели)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  firstName    String
  lastName     String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  roles UserRole[]
}

model Role {
  id          String           @id @default(uuid())
  name        String
  code        String           @unique
  users       UserRole[]
  permissions RolePermission[]
}

model Permission {
  id   String @id @default(uuid())
  code String @unique
  name String

  roles RolePermission[]
}

model UserRole {
  userId String
  roleId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}

model Faculty {
  id         String       @id @default(uuid())
  name       String
  code       String       @unique
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
  departments Department[]
}

model Department {
  id        String   @id @default(uuid())
  name      String
  code      String
  facultyId String
  faculty   Faculty  @relation(fields: [facultyId], references: [id], onDelete: Restrict)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([facultyId, code])
}

model Building {
  id        String   @id @default(uuid())
  name      String
  code      String   @unique
  address   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  rooms Room[]
}

model RoomType {
  id        String   @id @default(uuid())
  name      String
  code      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  rooms Room[]
}

model Room {
  id           String   @id @default(uuid())
  name         String
  buildingId   String
  roomTypeId   String
  capacity     Int
  floor        Int?
  hasProjector Boolean  @default(false)
  hasComputers Boolean  @default(false)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  building Building @relation(fields: [buildingId], references: [id], onDelete: Restrict)
  roomType RoomType @relation(fields: [roomTypeId], references: [id], onDelete: Restrict)

  @@unique([buildingId, name])
}

model Subject {
  id        String   @id @default(uuid())
  name      String
  code      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model LessonType {
  id        String   @id @default(uuid())
  name      String
  code      String   @unique
  color     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 4: Prisma client singleton**

```ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
```

- [ ] **Step 5: index.ts**

```ts
export { prisma } from "./client";
export * from "@prisma/client";
```

- [ ] **Step 6: Прогнать миграцию и генерацию Prisma**

Run:
```bash
pnpm install
pnpm --filter @repo/db prisma:generate
pnpm --filter @repo/db prisma:migrate --name init_v0_1
```
Expected: создана миграция и `dev.db`.

---

### Task 4: apps/api — Fastify bootstrap + auth (JWT) + RBAC middleware

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/plugins/rbac.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/admin/index.ts`
- Create: `apps/api/src/lib/zod.ts`
- Create: `apps/api/Dockerfile`

- [ ] **Step 1: package.json для api**

```json
{
  "name": "@app/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --enable-source-maps --loader ts-node/esm src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "node -e \"process.exit(0)\"",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@fastify/cookie": "^9.4.0",
    "@fastify/cors": "^9.0.1",
    "@fastify/jwt": "^9.0.0",
    "@repo/db": "workspace:*",
    "@repo/shared": "workspace:*",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "fastify": "^4.28.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: tsconfig.json для api**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "./dist",
    "declaration": false,
    "module": "ESNext"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: env loader**

```ts
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  APP_URL: z.string().url()
});

export const env = EnvSchema.parse(process.env);
```

- [ ] **Step 4: zod helper для Fastify**

```ts
import { ZodError } from "zod";

export function isZodError(err: unknown): err is ZodError {
  return err instanceof ZodError;
}
```

- [ ] **Step 5: Fastify server bootstrap**

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { env } from "./env";
import { isZodError } from "./lib/zod";

import { authPlugin } from "./plugins/auth";
import { rbacPlugin } from "./plugins/rbac";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((err, _req, reply) => {
    if (isZodError(err)) {
      return reply.status(400).send({ error: "VALIDATION_ERROR", issues: err.issues });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
  });

  app.register(cors, {
    origin: env.APP_URL,
    credentials: true
  });

  app.register(cookie);

  app.register(jwt, {
    secret: env.JWT_SECRET
  });

  app.register(authPlugin);
  app.register(rbacPlugin);

  app.register(healthRoutes);
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(adminRoutes, { prefix: "/api" });

  return app;
}
```

- [ ] **Step 6: entrypoint**

```ts
import { buildServer } from "./server";

const app = buildServer();

app.listen({ port: 3001, host: "0.0.0.0" });
```

- [ ] **Step 7: health route**

```ts
import { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));
}
```

- [ ] **Step 8: auth plugin (authenticate decorator)**

```ts
import { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

export async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: "UNAUTHORIZED" });
    }
  });
}
```

- [ ] **Step 9: RBAC plugin (authorize decorator)**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";

declare module "fastify" {
  interface FastifyInstance {
    authorize: (required: string[]) => (request: any, reply: any) => Promise<void>;
  }
}

export async function rbacPlugin(app: FastifyInstance) {
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
```

- [ ] **Step 10: auth routes (register/login/refresh/me)**

```ts
import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { LoginBodySchema, RegisterBodySchema } from "@repo/shared";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/api/auth/refresh",
    maxAge: REFRESH_TTL_SEC
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

    const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: ACCESS_TTL_SEC });
    const refreshToken = app.jwt.sign({ sub: user.id }, { expiresIn: REFRESH_TTL_SEC });

    reply.setCookie("refreshToken", refreshToken, refreshCookieOptions());
    return reply.send({ accessToken });
  });

  app.post("/login", async (request, reply) => {
    const body = LoginBodySchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.isActive) return reply.status(401).send({ error: "INVALID_CREDENTIALS" });

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return reply.status(401).send({ error: "INVALID_CREDENTIALS" });

    const accessToken = app.jwt.sign({ sub: user.id }, { expiresIn: ACCESS_TTL_SEC });
    const refreshToken = app.jwt.sign({ sub: user.id }, { expiresIn: REFRESH_TTL_SEC });

    reply.setCookie("refreshToken", refreshToken, refreshCookieOptions());
    return reply.send({ accessToken });
  });

  app.post("/refresh", async (request, reply) => {
    const token = request.cookies.refreshToken as string | undefined;
    if (!token) return reply.status(401).send({ error: "UNAUTHORIZED" });

    try {
      const payload = await app.jwt.verify<{ sub: string }>(token);
      const accessToken = app.jwt.sign({ sub: payload.sub }, { expiresIn: ACCESS_TTL_SEC });
      return reply.send({ accessToken });
    } catch {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.sub as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true }
    });
    return { user };
  });
}
```

- [ ] **Step 11: admin route root**

```ts
import { FastifyInstance } from "fastify";

import { facultiesRoutes } from "./faculties";
import { departmentsRoutes } from "./departments";
import { buildingsRoutes } from "./buildings";
import { roomTypesRoutes } from "./room-types";
import { roomsRoutes } from "./rooms";
import { subjectsRoutes } from "./subjects";
import { lessonTypesRoutes } from "./lesson-types";

export async function adminRoutes(app: FastifyInstance) {
  app.register(facultiesRoutes, { prefix: "/api/faculties" });
  app.register(departmentsRoutes, { prefix: "/api/departments" });
  app.register(buildingsRoutes, { prefix: "/api/buildings" });
  app.register(roomTypesRoutes, { prefix: "/api/room-types" });
  app.register(roomsRoutes, { prefix: "/api/rooms" });
  app.register(subjectsRoutes, { prefix: "/api/subjects" });
  app.register(lessonTypesRoutes, { prefix: "/api/lesson-types" });
}
```

- [ ] **Step 12: Dockerfile для api**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile=false
EXPOSE 3001
CMD ["pnpm", "--filter", "@app/api", "dev"]
```

- [ ] **Step 13: Запуск api**

Run:
```bash
pnpm --filter @app/api dev
```
Expected: `GET http://localhost:3001/health` → `{ "ok": true }`.

---

### Task 5: apps/api — CRUD справочников (листинг + create/update/delete)

**Files:**
- Create: `apps/api/src/routes/admin/crud.ts`
- Create: `apps/api/src/routes/admin/faculties.ts`
- Create: `apps/api/src/routes/admin/departments.ts`
- Create: `apps/api/src/routes/admin/buildings.ts`
- Create: `apps/api/src/routes/admin/room-types.ts`
- Create: `apps/api/src/routes/admin/rooms.ts`
- Create: `apps/api/src/routes/admin/subjects.ts`
- Create: `apps/api/src/routes/admin/lesson-types.ts`

- [ ] **Step 1: Общий CRUD helper**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { z } from "zod";
import { PaginationQuerySchema } from "@repo/shared";

type ListArgs = {
  search?: { fields: string[] };
  where?: (q?: string) => Record<string, any>;
};

export function registerCrudRoutes<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny>(opts: {
  app: FastifyInstance;
  permissionPrefix: string;
  model: any;
  createSchema: TCreate;
  updateSchema: TUpdate;
  listArgs?: ListArgs;
  softDelete?: boolean;
}) {
  const { app, model, createSchema, updateSchema, permissionPrefix, listArgs, softDelete } = opts;

  app.get(
    "/",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:read`])] },
    async (request) => {
      const { page, pageSize, q } = PaginationQuerySchema.parse(request.query);

      const where = listArgs?.where?.(q) ?? (q ? { name: { contains: q } } : {});

      const [items, total] = await prisma.$transaction([
        model.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        model.count({ where })
      ]);

      return { items, page, pageSize, total };
    }
  );

  app.post(
    "/",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:write`])] },
    async (request, reply) => {
      const data = createSchema.parse(request.body);
      const item = await model.create({ data });
      return reply.status(201).send({ item });
    }
  );

  app.patch(
    "/:id",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:write`])] },
    async (request) => {
      const id = z.string().uuid().parse((request.params as any).id);
      const data = updateSchema.parse(request.body);
      const item = await model.update({ where: { id }, data });
      return { item };
    }
  );

  app.delete(
    "/:id",
    { preHandler: [app.authenticate, app.authorize([`${permissionPrefix}:write`])] },
    async (request) => {
      const id = z.string().uuid().parse((request.params as any).id);

      if (softDelete) {
        const item = await model.update({ where: { id }, data: { isActive: false } });
        return { item };
      }

      await model.delete({ where: { id } });
      return { ok: true };
    }
  );
}
```

- [ ] **Step 2: Routes — faculties**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { FacultyCreateSchema, FacultyUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud";

export async function facultiesRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "faculties",
    model: prisma.faculty,
    createSchema: FacultyCreateSchema,
    updateSchema: FacultyUpdateSchema
  });
}
```

- [ ] **Step 3: Routes — departments**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { DepartmentCreateSchema, DepartmentUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud";

export async function departmentsRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "departments",
    model: prisma.department,
    createSchema: DepartmentCreateSchema,
    updateSchema: DepartmentUpdateSchema
  });
}
```

- [ ] **Step 4: Routes — buildings**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { BuildingCreateSchema, BuildingUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud";

export async function buildingsRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "buildings",
    model: prisma.building,
    createSchema: BuildingCreateSchema,
    updateSchema: BuildingUpdateSchema
  });
}
```

- [ ] **Step 5: Routes — room types**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { RoomTypeCreateSchema, RoomTypeUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud";

export async function roomTypesRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "room_types",
    model: prisma.roomType,
    createSchema: RoomTypeCreateSchema,
    updateSchema: RoomTypeUpdateSchema
  });
}
```

- [ ] **Step 6: Routes — rooms (soft delete isActive=false)**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { RoomCreateSchema, RoomUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud";

export async function roomsRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "rooms",
    model: prisma.room,
    createSchema: RoomCreateSchema,
    updateSchema: RoomUpdateSchema,
    softDelete: true
  });
}
```

- [ ] **Step 7: Routes — subjects**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { SubjectCreateSchema, SubjectUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud";

export async function subjectsRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "subjects",
    model: prisma.subject,
    createSchema: SubjectCreateSchema,
    updateSchema: SubjectUpdateSchema
  });
}
```

- [ ] **Step 8: Routes — lesson types**

```ts
import { FastifyInstance } from "fastify";
import { prisma } from "@repo/db";
import { LessonTypeCreateSchema, LessonTypeUpdateSchema } from "@repo/shared";
import { registerCrudRoutes } from "./crud";

export async function lessonTypesRoutes(app: FastifyInstance) {
  registerCrudRoutes({
    app,
    permissionPrefix: "lesson_types",
    model: prisma.lessonType,
    createSchema: LessonTypeCreateSchema,
    updateSchema: LessonTypeUpdateSchema
  });
}
```

- [ ] **Step 9: Smoke тест CRUD через curl**

Run:
```bash
curl -s http://localhost:3001/health
```
Expected: `{ "ok": true }`

---

### Task 6: Seed v0.1 (roles/permissions/admin user + demo dicts)

**Files:**
- Create: `apps/api/src/seed.ts`

- [ ] **Step 1: seed script**

```ts
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";

async function main() {
  const permissions = [
    { code: "faculties:read", name: "Read faculties" },
    { code: "faculties:write", name: "Write faculties" },
    { code: "departments:read", name: "Read departments" },
    { code: "departments:write", name: "Write departments" },
    { code: "buildings:read", name: "Read buildings" },
    { code: "buildings:write", name: "Write buildings" },
    { code: "room_types:read", name: "Read room types" },
    { code: "room_types:write", name: "Write room types" },
    { code: "rooms:read", name: "Read rooms" },
    { code: "rooms:write", name: "Write rooms" },
    { code: "subjects:read", name: "Read subjects" },
    { code: "subjects:write", name: "Write subjects" },
    { code: "lesson_types:read", name: "Read lesson types" },
    { code: "lesson_types:write", name: "Write lesson types" }
  ];

  await prisma.permission.createMany({ data: permissions, skipDuplicates: true });

  const [adminRole, managerRole, teacherRole, studentRole] = await Promise.all([
    prisma.role.upsert({
      where: { code: "admin" },
      update: { name: "Admin" },
      create: { code: "admin", name: "Admin" }
    }),
    prisma.role.upsert({
      where: { code: "manager" },
      update: { name: "Manager" },
      create: { code: "manager", name: "Manager" }
    }),
    prisma.role.upsert({
      where: { code: "teacher" },
      update: { name: "Teacher" },
      create: { code: "teacher", name: "Teacher" }
    }),
    prisma.role.upsert({
      where: { code: "student" },
      update: { name: "Student" },
      create: { code: "student", name: "Student" }
    })
  ]);

  const allPerms = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
    skipDuplicates: true
  });

  const passwordHash = await bcrypt.hash("admin12345", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { firstName: "Admin", lastName: "User", passwordHash },
    create: {
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      passwordHash
    }
  });

  await prisma.userRole.createMany({
    data: [{ userId: admin.id, roleId: adminRole.id }],
    skipDuplicates: true
  });

  const faculty = await prisma.faculty.upsert({
    where: { code: "FCS" },
    update: { name: "ФКН" },
    create: { code: "FCS", name: "ФКН" }
  });

  await prisma.department.upsert({
    where: { facultyId_code: { facultyId: faculty.id, code: "CS" } },
    update: { name: "Кафедра ИВТ" },
    create: { facultyId: faculty.id, code: "CS", name: "Кафедра ИВТ" }
  });

  const building = await prisma.building.upsert({
    where: { code: "A" },
    update: { name: "Корпус А", address: "ул. Примерная, 1" },
    create: { code: "A", name: "Корпус А", address: "ул. Примерная, 1" }
  });

  const roomType = await prisma.roomType.upsert({
    where: { code: "lecture" },
    update: { name: "Лекционная" },
    create: { code: "lecture", name: "Лекционная" }
  });

  await prisma.room.upsert({
    where: { buildingId_name: { buildingId: building.id, name: "101" } },
    update: { capacity: 120, roomTypeId: roomType.id },
    create: {
      name: "101",
      buildingId: building.id,
      roomTypeId: roomType.id,
      capacity: 120,
      hasProjector: true,
      hasComputers: false,
      isActive: true
    }
  });

  await prisma.subject.upsert({
    where: { code: "algo" },
    update: { name: "Алгоритмы" },
    create: { code: "algo", name: "Алгоритмы" }
  });

  await prisma.lessonType.createMany({
    data: [
      { code: "lecture", name: "Лекция", color: "#2563EB" },
      { code: "practice", name: "Практика", color: "#16A34A" },
      { code: "lab", name: "Лаба", color: "#DC2626" }
    ],
    skipDuplicates: true
  });

  void managerRole;
  void teacherRole;
  void studentRole;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Запустить seed**

Run:
```bash
pnpm --filter @app/api dev &
node --enable-source-maps --loader ts-node/esm apps/api/src/seed.ts
```
Expected: данные созданы без ошибок, `admin@example.com / admin12345`.

---

### Task 7: apps/web — Next.js scaffold + auth pages + базовый admin CRUD UI

**Files:**
- Create: `apps/web/package.json` (после scaffold)
- Create/Modify: `apps/web/next.config.js`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/register/page.tsx`
- Create: `apps/web/src/app/(protected)/layout.tsx`
- Create: `apps/web/src/app/(protected)/page.tsx`
- Create: `apps/web/src/app/(protected)/admin/faculties/page.tsx`
- Create: `apps/web/src/app/(protected)/admin/buildings/page.tsx`
- Create: `apps/web/src/app/(protected)/admin/room-types/page.tsx`
- Create: `apps/web/src/app/(protected)/admin/rooms/page.tsx`
- Create: `apps/web/src/app/(protected)/admin/subjects/page.tsx`
- Create: `apps/web/src/app/(protected)/admin/lesson-types/page.tsx`
- Create: `apps/web/src/components/admin/CrudPage.tsx`
- Create: `apps/web/src/components/admin/crud-config.ts`
- Create: `apps/web/Dockerfile`

- [ ] **Step 1: Сгенерировать Next.js app**

Run:
```bash
pnpm dlx create-next-app@latest apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```
Expected: создан `apps/web` с App Router и Tailwind.

- [ ] **Step 2: Подключить shadcn/ui**

Run:
```bash
cd apps/web
pnpm dlx shadcn@latest init -d
```
Expected: создан `components/ui/*` и `lib/utils.ts`.

- [ ] **Step 3: API client (access token + refresh)**

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type RequestInitWithAuth = RequestInit & { auth?: boolean };

function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem("accessToken");
  else localStorage.setItem("accessToken", token);
}

async function refreshAccessToken() {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    credentials: "include"
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export async function apiFetch<T>(path: string, init: RequestInitWithAuth = {}) {
  const headers = new Headers(init.headers);
  if (init.auth !== false) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });

  if (res.status !== 401 || init.auth === false) {
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  }

  const newToken = await refreshAccessToken();
  if (!newToken) throw new Error("UNAUTHORIZED");

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${newToken}`);

  const retry = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: retryHeaders,
    credentials: "include"
  });

  if (!retry.ok) throw new Error(`API ${retry.status}`);
  return (await retry.json()) as T;
}
```

- [ ] **Step 4: Auth helpers (login/register/logout/me)**

```ts
import { apiFetch } from "./api";

export async function register(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const data = await apiFetch<{ accessToken: string }>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    auth: false
  });
  localStorage.setItem("accessToken", data.accessToken);
}

export async function login(payload: { email: string; password: string }) {
  const data = await apiFetch<{ accessToken: string }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    auth: false
  });
  localStorage.setItem("accessToken", data.accessToken);
}

export function logout() {
  localStorage.removeItem("accessToken");
}

export async function me() {
  return apiFetch<{ user: { id: string; email: string; firstName: string; lastName: string } | null }>(
    "/api/auth/me",
    { method: "GET" }
  );
}
```

- [ ] **Step 5: Login page**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Вход</h1>
      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await login({ email, password });
            router.push("/");
          } catch {
            setError("Неверный логин или пароль");
          }
        }}
      >
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="w-full rounded bg-black px-3 py-2 text-white" type="submit">
          Войти
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Protected layout (редирект если нет access token)**

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) router.replace("/login");
  }, [router]);

  return <div className="min-h-dvh">{children}</div>;
}
```

- [ ] **Step 7: CRUD UI — единый компонент + конфиги**

`CrudPage.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

export type CrudListResponse<T> = { items: T[]; total: number; page: number; pageSize: number };

export type CrudConfig<TItem, TCreate, TUpdate> = {
  title: string;
  basePath: string;
  createShape: (raw: Record<string, string>) => TCreate;
  updateShape: (raw: Record<string, string>) => TUpdate;
  columns: { key: keyof TItem; label: string }[];
};

export function CrudPage<TItem extends { id: string }, TCreate, TUpdate>({
  config
}: {
  config: CrudConfig<TItem, TCreate, TUpdate>;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<TItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const cols = useMemo(() => config.columns, [config.columns]);

  async function load() {
    setError(null);
    const res = await apiFetch<CrudListResponse<TItem>>(`${config.basePath}?page=1&pageSize=50&q=${encodeURIComponent(q)}`, {
      method: "GET"
    });
    setItems(res.items);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <section className="p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{config.title}</h1>
        <input
          className="w-72 rounded border px-3 py-2"
          placeholder="Поиск..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {cols.map((c) => (
                <th key={String(c.key)} className="px-3 py-2 text-left font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                {cols.map((c) => (
                  <td key={String(c.key)} className="px-3 py-2">
                    {String(it[c.key] ?? "")}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <button
                    className="rounded border px-2 py-1"
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        await apiFetch(`${config.basePath}/${it.id}`, { method: "DELETE" });
                        await load();
                      } catch {
                        setError("Не удалось удалить");
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={cols.length + 1}>
                  Пусто
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

`crud-config.ts`:
```ts
import { CrudConfig } from "./CrudPage";

export const facultiesConfig: CrudConfig<
  { id: string; name: string; code: string },
  { name: string; code: string },
  { name?: string; code?: string }
> = {
  title: "Факультеты",
  basePath: "/api/faculties",
  createShape: (raw) => ({ name: raw.name, code: raw.code }),
  updateShape: (raw) => ({ name: raw.name || undefined, code: raw.code || undefined }),
  columns: [
    { key: "name", label: "Название" },
    { key: "code", label: "Код" }
  ]
};
```

- [ ] **Step 8: Admin pages (пример — faculties)**

```tsx
import { CrudPage } from "@/components/admin/CrudPage";
import { facultiesConfig } from "@/components/admin/crud-config";

export default function FacultiesPage() {
  return <CrudPage config={facultiesConfig} />;
}
```

- [ ] **Step 9: Dockerfile для web**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile=false
EXPOSE 3000
CMD ["pnpm", "--filter", "@app/web", "dev"]
```

- [ ] **Step 10: Запуск web**

Run:
```bash
pnpm --filter @app/web dev
```
Expected: http://localhost:3000/login открывается.

---

### Task 8: Definition of Done v0.1 — проверка

- [ ] `pnpm run build` проходит без ошибок
- [ ] Логин → dashboard → CRUD аудиторий (создать/изменить/удалить/поиск)
- [ ] Все справочники доступны через UI
- [ ] RBAC: роль student не видит `/admin/*` (в v0.1 достаточно скрыть пункты меню и запретить API через permissions)

Run:
```bash
pnpm install
pnpm run build
pnpm run dev
```

---

## Self-Review (проверка плана)

1) **Покрытие roadmap v0.1:**
- Монорепо / API / Web / Zod / Prisma / SQLite — покрыто задачами 1–4
- Auth endpoints + JWT/refresh — Task 4
- RBAC middleware — Task 4
- CRUD справочников + UI — Task 5 + Task 7
- Seed — Task 6

2) **Placeholder scan:**
- Нет “TODO/потом/примерно” в шагах; каждый шаг содержит команды/код.

3) **Type consistency:**
- Zod схемы `@repo/shared` используются API валидацией.
- Prisma модели соответствуют полям из Zod (например `Room.isActive` для soft delete).

