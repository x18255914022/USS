# University Schedule System (USS)

Система расписания вуза: справочники, составление расписания менеджерами, просмотр студентами и преподавателями, запросы на изменения с уведомлениями в Telegram.

Текущее состояние: **v0.9** — реализованы v0.1–v0.8 полностью, v0.9 частично (не сделаны E2E-тесты и часть UX-полировки). См. [ROADMAP-PROMPT.md](./ROADMAP-PROMPT.md).

## Состав

| Модуль | Описание | Стек |
|---|---|---|
| `apps/api` (:3001) | REST API: auth (JWT + refresh), RBAC, справочники, расписание, изменения, iCal-экспорт, очередь уведомлений | Fastify 4, Prisma, Zod, BullMQ |
| `apps/web` (:3000) | Веб-приложение: просмотр расписания, визуальный редактор (drag & drop), админка, запросы на изменения | Next.js 16, React 19, Tailwind 4, TanStack Query, Zustand, dnd-kit |
| `apps/bot` | Telegram-бот: расписание, запросы на отмену, привязка аккаунта | grammy |
| `apps/worker` | Фоновая отправка уведомлений (BullMQ + Redis), тихие часы | BullMQ |
| `packages/db` | Prisma-схема (SQLite), миграции, клиент | Prisma 5 |
| `packages/shared` | Общие Zod-схемы, Redis-клиент, типы очередей | Zod, ioredis |

## Требования

- Node.js 20+
- pnpm 9+
- Docker (для Redis через compose) — опционально, можно поднять Redis локально

## Быстрый старт (локально)

```bash
# 1. Установка зависимостей
pnpm install

# 2. Переменные окружения
cp .env.example .env

# 3. Redis (docker compose up -d redis) или свой инстанс

# 4. Prisma: генерация клиента + миграции
pnpm --filter @repo/db prisma:generate
pnpm --filter @repo/db prisma:migrate

# 5. Сидирование (роли, пользователи, справочники, демо-расписание)
pnpm --filter @app/api build   # seed требует сборки
pnpm --filter @app/api seed

# 6. Запуск (web + api + worker параллельно)
pnpm dev
```

По умолчанию: Web — http://localhost:3000, API — http://localhost:3001. Bull Board (мониторинг очередей) — `/admin/queues`.

Telegram-бот запускается отдельно и требует `TELEGRAM_BOT_TOKEN`:

```bash
pnpm --filter @app/bot dev
```

## Docker Compose

```bash
docker compose up --build
```

Сервисы: `api` (:3001), `web` (:3000), `worker`, `redis`. Бот в compose отсутствует — запускается вручную (см. выше). Конфигурация dev-режим.

## Тесты

```bash
pnpm --filter @app/api test:unit          # unit (vitest)
pnpm --filter @app/api test:integration  # integration (vitest)
pnpm --filter @app/worker test            # node:test (quiet hours, backoff)
```

## Тестовые учётные записи (seed)

- Admin: `admin@example.com` / `admin12345`
- Student: `student@example.com` / `student12345`

Переопределяются через `SEED_ADMIN_*` / `SEED_STUDENT_*`.

## Переменные окружения

Минимально необходимые:

- `DATABASE_URL` — например `file:./packages/db/prisma/dev.db`
- `JWT_SECRET` — минимум 16 символов
- `REFRESH_TOKEN_SECRET` — минимум 16 символов
- `APP_URL` — URL приложения (например `http://localhost:3000`)

Дополнительно:

- `PORT` — порт API (по умолчанию `3001`)
- `INTERNAL_API_URL` — URL API для server-side запросов в `apps/web` (по умолчанию `http://localhost:3001`)
- `NEXT_PUBLIC_API_URL` — базовый URL API для client-side запросов (по умолчанию относительный `/api/...`)
- `REDIS_URL` — Redis для очередей (по умолчанию `redis://localhost:6379`)
- `TELEGRAM_BOT_TOKEN` — токен Telegram-бота (бот и worker завершаются с кодом 0 без него)
- `BOT_TOKEN` / `API_URL` — service-token для HTTP-взаимодействия бота с API
- `UNIVERSITY_TZ` — часовой пояс (тихие часы уведомлений)
- `ALLOWED_ORIGINS` — CORS origins
