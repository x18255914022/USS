# University Schedule System (USS)

![Статус: v0.9](https://img.shields.io/badge/версия-v0.9-orange)
![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![pnpm 9+](https://img.shields.io/badge/pnpm-9%2B-F69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![Fastify 4](https://img.shields.io/badge/Fastify-4-000000?logo=fastify&logoColor=white)
![Prisma 6](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)

Система расписания вуза: справочники, составление расписания менеджерами, просмотр студентами и преподавателями, запросы на изменения с уведомлениями в Telegram.

Текущее состояние: **v0.9** — реализованы v0.1–v0.8 полностью, v0.9 частично (не сделаны E2E-тесты и часть UX-полировки). См. [ROADMAP-PROMPT.md](./ROADMAP-PROMPT.md).

## Оглавление

- [Назначение и возможности](#назначение-и-возможности)
- [Состав и стек](#состав-и-стек)
- [Требования](#требования)
- [Установка и запуск](#установка-и-запуск)
  - [Быстрый старт (локально)](#быстрый-старт-локально)
  - [Docker Compose](#docker-compose)
- [Примеры использования](#примеры-использования)
- [Структура проекта](#структура-проекта)
- [Переменные окружения](#переменные-окружения)
- [Тестовые учётные записи (seed)](#тестовые-учётные-записи-seed)
- [Тесты и проверки](#тесты-и-проверки)
- [Разработка и вклад в проект](#разработка-и-вклад-в-проект)
- [Дополнительная документация](#дополнительная-документация)

## Назначение и возможности

USS закрывает полный цикл работы с учебным расписанием вуза:

- **Справочники** — группы, преподаватели, дисциплины, аудитории, семестры и временные слоты.
- **Составление расписания** — менеджеры собирают расписание в визуальном редакторе с drag & drop и автоматической проверкой конфликтов (аудитории, преподаватели, группы).
- **Просмотр** — студенты и преподаватели смотрят своё расписание по неделям, включая чётные/нечётные недели и переопределения на конкретные даты.
- **Изменения** — поддерживаются типы CANCEL, RESCHEDULE и EXTRA; пользователи могут отправлять запросы на изменение, менеджеры их рассматривают.
- **Уведомления** — фоновая очередь (BullMQ + Redis) рассылает уведомления в Telegram с учётом «тихих часов».
- **Экспорт** — расписание группы выгружается в iCal для подписки из календарных приложений.
- **Telegram-бот** — просмотр расписания, запросы на отмену, привязка аккаунта по коду.

Роли: студент, преподаватель, менеджер расписания, администратор (RBAC на уровне API).

## Состав и стек

| Модуль | Описание | Стек |
|---|---|---|
| `apps/api` (:3001) | REST API: auth (JWT + refresh), RBAC, справочники, расписание, изменения, iCal-экспорт, очередь уведомлений | Fastify 4, Prisma, Zod, BullMQ |
| `apps/web` (:3000) | Веб-приложение: просмотр расписания, визуальный редактор (drag & drop), админка, запросы на изменения | Next.js 16, React 19, Tailwind 4, TanStack Query, Zustand, dnd-kit |
| `apps/bot` | Telegram-бот: расписание, запросы на отмену, привязка аккаунта | grammy |
| `apps/worker` | Фоновая отправка уведомлений (BullMQ + Redis), тихие часы | BullMQ |
| `packages/db` | Prisma-схема (PostgreSQL), миграции, клиент | Prisma 6 |
| `packages/shared` | Общие Zod-схемы, Redis-клиент, типы очередей | Zod, ioredis |

Монорепозиторий: pnpm workspaces + Turborepo. База данных — PostgreSQL (миграция с SQLite выполнена в v1.0; dev-инстанс поднимается через `docker compose up -d postgres`).

## Требования

- Node.js 20+
- pnpm 9+
- Docker (для PostgreSQL и Redis через compose) — опционально, можно поднять их локально

## Установка и запуск

### Быстрый старт (локально)

```bash
# 1. Установка зависимостей
pnpm install

# 2. Переменные окружения
cp .env.example .env

# 3. PostgreSQL и Redis (docker compose up -d postgres redis) или свои инстансы

# 4. Prisma: генерация клиента + миграции
pnpm --filter @repo/db prisma:generate
pnpm --filter @repo/db prisma:migrate

# 5. Сидирование (роли, пользователи, справочники, демо-расписание)
#    скрипт seed сам выполняет build
pnpm --filter @app/api seed

# 6. Запуск (web + api + worker параллельно)
pnpm dev
```

По умолчанию: Web — http://localhost:3000, API — http://localhost:3001. Bull Board (мониторинг очередей) — `/admin/queues`.

Telegram-бот запускается отдельно и требует `TELEGRAM_BOT_TOKEN`:

```bash
pnpm --filter @app/bot dev
```

### Docker Compose

```bash
docker compose up --build
```

Сервисы: `api` (:3001), `web` (:3000), `worker`, `redis`. Бот в compose отсутствует — запускается вручную (см. выше). Конфигурация dev-режим.

## Примеры использования

Проверка, что API запущен:

```bash
curl http://localhost:3001/health
# {"ok":true}
```

Вход и получение JWT access-токена (после seed доступен администратор, см. [тестовые учётные записи](#тестовые-учётные-записи-seed)):

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin12345"}'
# {"accessToken":"<JWT>"}
```

Получить расписание группы на неделю, содержащую указанную дату:

```bash
curl "http://localhost:3001/api/schedule/group/<groupId>?date=2026-09-15" \
  -H "Authorization: Bearer <JWT>"
```

Экспорт расписания группы в iCal (сначала получите долгоживущий токен подписки):

```bash
# 1. Получить токен подписки (действует 365 дней)
curl http://localhost:3001/api/schedule/group/<groupId>/export-token \
  -H "Authorization: Bearer <JWT>"
# {"token":"<ICAL_TOKEN>"}

# 2. Подписаться на календарь (URL можно добавить в Google Calendar и т.п.)
curl "http://localhost:3001/api/schedule/group/<groupId>/export?format=ical&token=<ICAL_TOKEN>" \
  -o schedule.ics
```

Создать запрос на изменение (например, отмену занятия) от имени преподавателя:

```bash
curl -X POST http://localhost:3001/api/changes \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"type": "CANCEL", "lessonId": "<lessonId>", "reason": "Болезнь преподавателя"}'
```

Другие полезные эндпоинты: `GET /api/schedule/teacher/:teacherId`, `GET /api/schedule/room/:roomId`, `GET /api/schedule/me` (моё расписание), `GET /api/schedule/conflicts` (поиск конфликтов), `GET /api/changes` (список запросов на изменения).

## Структура проекта

```
USS/
├── apps/
│   ├── api/        # REST API (Fastify): src/routes, src/services, src/plugins, seed
│   ├── web/        # Веб-приложение (Next.js App Router): app/, components/, lib/
│   ├── bot/        # Telegram-бот (grammy)
│   └── worker/     # Фоновые задачи: отправка уведомлений, тихие часы
├── packages/
│   ├── db/         # Prisma-схема, миграции и клиент (@repo/db)
│   └── shared/     # Общие Zod-схемы, Redis-клиент, типы очередей (@repo/shared)
├── docs/           # Документация (DEPLOYMENT.md и др.)
├── scripts/        # Вспомогательные скрипты (init, cleanup)
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

## Переменные окружения

Минимально необходимые:

- `DATABASE_URL` — строка подключения PostgreSQL, например `postgresql://uss:uss_dev_password@localhost:5432/uss` (креды dev-инстанса из `docker compose up -d postgres`)
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

Полный пример — в [.env.example](./.env.example).

## Тестовые учётные записи (seed)

- Admin: `admin@example.com` / `admin12345`
- Student: `student@example.com` / `student12345`

Переопределяются через `SEED_ADMIN_*` / `SEED_STUDENT_*`.

## Тесты и проверки

```bash
pnpm --filter @app/api test:unit          # unit (vitest)
pnpm --filter @app/api test:integration  # integration (vitest)
pnpm --filter @app/worker test            # node:test (quiet hours, backoff)

pnpm lint                                 # линт всех пакетов (turbo)
pnpm typecheck                            # проверка типов (tsc --noEmit)
pnpm format                               # prettier
```

## Разработка и вклад в проект

Проект — монорепозиторий на pnpm workspaces с Turborepo: общие команды (`dev`, `build`, `lint`, `typecheck`) запускаются из корня и применяются ко всем пакетам. Исходники на TypeScript (strict-режим, общий `tsconfig.base.json`), форматирование — Prettier.

Типичный процесс:

1. Создайте ветку от `main` и внесите изменения.
2. Убедитесь, что проходят `pnpm typecheck`, `pnpm lint` и тесты затронутых пакетов.
3. При изменении схемы БД добавьте миграцию: `pnpm --filter @repo/db prisma:migrate --name <имя_миграции>`.
4. Откройте Pull Request с описанием изменений.

Руководство для контрибьюторов: см. `CONTRIBUTING.md` *(файл будет добавлен отдельной задачей — ссылка появится здесь)*.

## Дополнительная документация

- [ROADMAP-PROMPT.md](./ROADMAP-PROMPT.md) — дорожная карта по версиям и статус реализации (включая известные отклонения: уведомления только в Telegram, отключённый rate limiting).
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — полная инструкция по развёртыванию: локальный запуск, переменные окружения, проверка работоспособности, траблшутинг, известные ограничения.
- [AGENTS.md](./AGENTS.md) — настройки агентов для AI-ассистентов в этом репозитории.
