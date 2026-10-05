# Развёртывание University Schedule System (USS)

Текущая версия: **v0.9**. Документ описывает два способа запуска: локальную разработку и Docker Compose (dev-режим). Продакшн-образов в проекте нет — см. раздел «Известные ограничения».

## Требования

- **Node.js 20+** (Docker-образы собираются на `node:24-alpine`)
- **pnpm 9+** (в `package.json` зафиксирован `packageManager: pnpm@9.0.0`)
- **Docker + Docker Compose** — опционально: нужен только для Redis (можно поднять Redis локально без Docker)

## Переменные окружения

Конфигурация — через файл `.env` в корне репозитория (шаблон: `.env.example`). API читает `.env` из рабочей директории (`apps/api`) или из корня репозитория на два уровня выше (`apps/api/src/env.ts:7-13`).

| Переменная | Где используется | Default | Обязательность |
|---|---|---|---|
| `DATABASE_URL` | API, seed, Prisma | `postgresql://uss:uss_dev_password@localhost:5432/uss` | **Да** (API не стартует без неё) |
| `JWT_SECRET` | API | — | **Да**, минимум 16 символов |
| `REFRESH_TOKEN_SECRET` | API | — | **Да**, минимум 16 символов |
| `APP_URL` | API (ссылки в уведомлениях) | — | **Да**, валидный URL (например `http://localhost:3000`) |
| `PORT` | API | `3001` | Нет |
| `REDIS_URL` | API, worker, `@repo/shared` | `redis://localhost:6379` | Нет (но без Redis очереди работать не будут) |
| `TELEGRAM_BOT_TOKEN` | bot, worker, API | — | Для бота и worker: да. Без него бот и worker **молча завершаются с кодом 0** (`apps/bot/src/index.ts:9-12`, `apps/worker/src/index.ts:9-12`). В API — опционально (мин. 16 символов) |
| `BOT_TOKEN` | API (проверка `x-bot-token`), bot | — | Для работы бота с API: да. Значения в API и боте должны **совпадать** |
| `API_URL` | bot (HTTP-запросы к API) | `http://localhost:3001` | Нет |
| `UNIVERSITY_TZ` | worker (тихие часы), bot | `UTC` | Нет |
| `INTERNAL_API_URL` | web (server-side запросы) | `http://localhost:3001` | Нет |
| `NEXT_PUBLIC_API_URL` | web (client-side запросы) | `""` (запросы на тот же origin) | Нет |
| `ALLOWED_ORIGINS` | API (CORS) | — | Нет |
| `ACCESS_TOKEN_TTL` | API (секунды) | `900` | Нет |
| `REFRESH_TOKEN_TTL` | API (секунды) | `604800` | Нет |
| `RATE_LIMIT_MAX` | API | `100` | Нет |
| `RATE_LIMIT_WINDOW_MS` | API | `60000` | Нет |
| `BODY_LIMIT` | API (байты) | `1048576` | Нет |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_FIRST_NAME` / `SEED_ADMIN_LAST_NAME` / `SEED_ADMIN_RESET_PASSWORD` | seed | `admin@example.com` / `admin12345` / `Admin` / `User` / `0` | Нет |
| `SEED_STUDENT_EMAIL` / `SEED_STUDENT_PASSWORD` / `SEED_STUDENT_FIRST_NAME` / `SEED_STUDENT_LAST_NAME` | seed | `student@example.com` / `student12345` / `Student` / `User` | Нет |

**Минимум для локального запуска без бота:** `DATABASE_URL`, `JWT_SECRET` (≥16), `REFRESH_TOKEN_SECRET` (≥16), `APP_URL`, работающие PostgreSQL (`docker compose up -d postgres`) и Redis (`REDIS_URL` по умолчанию указывает на `localhost:6379`).

**Для полного запуска с ботом:** добавьте `TELEGRAM_BOT_TOKEN` и `BOT_TOKEN` (одинаковый в API и боте), при необходимости поправьте `API_URL`.

> Нюанс `DATABASE_URL`: это строка подключения PostgreSQL. Dev-значение по умолчанию (`postgresql://uss:uss_dev_password@localhost:5432/uss`) совпадает с кредами сервиса `postgres` в `docker-compose.yml`. Prisma CLI (`prisma:migrate`, `prisma:studio`) запускается из корня репозитория через `packages/db/scripts/run-prisma.mjs`, чтобы читать корневой `.env` (pnpm run выполняет скрипты в `packages/db`, где корневой `.env` не виден). Внутри compose-контейнеров `DATABASE_URL` переопределён на `postgresql://uss:uss_dev_password@postgres:5432/uss` (имя сервиса).

## Вариант 1 — Локальная разработка

### Автоматическая инициализация (рекомендуется)

Скрипты `scripts/init.sh` (Linux/macOS) и `scripts/init.ps1` (Windows, требуется PowerShell 7) выполняют:

1. Проверку наличия `pnpm` и `docker` (и запущенного демона Docker);
2. `pnpm install` (пропускается, если `node_modules` уже есть);
3. `pnpm --filter @repo/db prisma:generate` — генерация Prisma Client;
4. `docker compose up -d redis postgres` — подъём Redis и PostgreSQL в Docker.

```bash
# Linux/macOS
./scripts/init.sh

# Windows (PowerShell 7+)
.\scripts\init.ps1
```

Флаги: `--skip-docker` / `-SkipDocker` (пропустить подъём Redis/PostgreSQL, если они уже работают), `--purge` / `-Purge` (сначала полная очистка через cleanup-скрипт).

> **Важно:** init-скрипты **не** выполняют миграции и seed — их нужно запустить вручную (шаги 4–5 ниже).

### Пошаговый запуск вручную

```bash
# 1. Установка зависимостей
pnpm install

# 2. Переменные окружения
cp .env.example .env
# Отредактируйте .env: JWT_SECRET и REFRESH_TOKEN_SECRET минимум 16 символов

# 3. PostgreSQL и Redis: либо через Docker
docker compose up -d postgres redis
# либо свои инстансы (PostgreSQL на localhost:5432, Redis на localhost:6379)

# 4. Prisma: генерация клиента + миграции
pnpm --filter @repo/db prisma:generate
pnpm --filter @repo/db prisma:migrate

# 5. Сидирование (роли, пользователи, справочники, демо-расписание)
pnpm --filter @app/api seed

# 6. Запуск web + api + worker параллельно
pnpm dev
```

По умолчанию: Web — http://localhost:3000, API — http://localhost:3001.

> Нюанс seed: скрипт `seed` в `apps/api/package.json` сам выполняет `pnpm build` перед запуском (`"seed": "pnpm build && node dist/seed.js"`), поэтому отдельная сборка API не требуется — но seed работает именно с собранным `dist/seed.js`, а не с исходниками.

### Telegram-бот

Бот запускается отдельно (в `pnpm dev` он не входит) и требует `TELEGRAM_BOT_TOKEN`:

```bash
pnpm --filter @app/bot dev
```

Без токена процесс печатает `[Bot] TELEGRAM_BOT_TOKEN not set. Bot will not start.` и завершается с кодом 0 — это штатное поведение, не ошибка.

### Полезные команды

```bash
pnpm --filter @repo/db prisma:studio   # Prisma Studio (GUI для БД)
pnpm --filter @app/api test            # unit + integration тесты API
```

## Вариант 2 — Docker Compose (dev)

```bash
docker compose up --build
```

Поднимаются сервисы (`docker-compose.yml`):

| Сервис | Порт | Описание |
|---|---|---|
| `api` | 3001 → 3001 | Fastify API, запускается как `pnpm --filter @app/api dev` |
| `web` | 3000 → 3000 | Next.js, запускается как `pnpm --filter @app/web dev` |
| `worker` | — | Обработчик очередей уведомлений |
| `redis` | — (порт не публикуется) | `redis:7-alpine`, persistence в volume `redis_data` (`--appendonly yes`) |
| `postgres` | 5432 → 5432 | `postgres:16-alpine`, volume `postgres_data`, healthcheck `pg_isready` |

Особенности:

- **Бот в compose отсутствует** — запускается вручную на хосте (см. выше).
- Образы **dev-only**: `node:24-alpine`, копируется весь репозиторий, `pnpm install --no-frozen-lockfile`, внутри контейнера запускается `pnpm dev` (hot-reload-режим). Это не продакшн-сборка.
- Все сервисы читают `.env` из корня (`env_file: .env`). Healthcheck в compose настроен только у `postgres` (`pg_isready`).
- Worker без `TELEGRAM_BOT_TOKEN` штатно завершается с кодом 0 — для работы очередей уведомлений токен нужен и в compose.

Логи и остановка:

```bash
docker compose logs -f api        # логи сервиса
docker compose down               # остановить контейнеры
docker compose down -v            # остановить и удалить volume с данными Redis и PostgreSQL
```

Скрипты очистки (останавливают контейнеры, удаляют `.turbo`/`dist`, освобождают порты 3000/3001; с флагом purge — удаляют `node_modules` и volumes):

```bash
./scripts/cleanup.sh              # Linux/macOS
.\scripts\cleanup.ps1             # Windows (PowerShell 7+)
# флаги: --purge / -Purge, --ports-only / -PortsOnly
```

> Нюанс Redis в compose: сервис `redis` не публикует порт наружу, а `REDIS_URL` из `.env` по умолчанию указывает на `redis://localhost:6379`. Внутри контейнеров `localhost` — это сам контейнер, поэтому для сервисов `api` и `worker` в `docker-compose.yml` `REDIS_URL` переопределён на `redis://redis:6379` (имя сервиса). Для локального запуска на хосте с тем же `.env` значение `redis://localhost:6379` остаётся корректным.

## Проверка работоспособности

```bash
# Health-check API
curl http://localhost:3001/health
# → {"ok":true}
```

1. Откройте http://localhost:3000 и войдите под seed-учётной записью:
   - Admin: `admin@example.com` / `admin12345`
   - Student: `student@example.com` / `student12345`
2. **Bull Board** (мониторинг очередей): http://localhost:3001/admin/queues — защищён авторизацией, нужен аккаунт с правом `queues:read` (admin).
3. **Redis**: `docker compose exec redis redis-cli ping` → `PONG` (в варианте с compose).

## Траблшутинг

| Симптом | Причина / решение |
|---|---|
| `EADDRINUSE` на 3000/3001 | Порты заняты. `./scripts/cleanup.sh --ports-only` (Linux/macOS) или вручную освободите процессы |
| API падает при старте с ошибкой Zod о `JWT_SECRET` | Секрет короче 16 символов или отсутствует |
| API стартует, но в логах ошибки подключения к Redis | Redis не запущен. `docker compose up -d redis` или проверьте `REDIS_URL`. BullMQ ретраит подключение, API при этом обычно не падает целиком |
| API/Prisma не подключается к PostgreSQL | PostgreSQL не запущен (`docker compose up -d postgres`) или неверный `DATABASE_URL`. Для Prisma CLI корневой `.env` читается через `scripts/run-prisma.mjs` из корня репозитория |
| Worker «не работает» и молча завершается | Без `TELEGRAM_BOT_TOKEN` worker завершается с кодом 0 по дизайну (`apps/worker/src/index.ts:9-12`). С токеном, но без Redis — будет ретраить подключение |
| Бот не стартует, код выхода 0 | Не задан `TELEGRAM_BOT_TOKEN` — штатное поведение |
| Бот стартует, но запросы к API отклоняются | Не задан или не совпадает `BOT_TOKEN` у бота и API |
| Ошибки импорта `@repo/db` (`Cannot find module ...`) | Prisma Client не сгенерирован. `pnpm --filter @repo/db prisma:generate` (и для seed — не забудьте `pnpm --filter @repo/db build` / `pnpm build`, так как `@repo/db` импортируется из `dist`) |
| Seed завершается ошибкой / ничего не делает | Seed работает с `dist/seed.js`; скрипт `pnpm --filter @app/api seed` сам делает build. Прямой запуск `node dist/seed.js` без сборки упадёт |
| Ошибка `P2021`/«table does not exist» | Миграции не применены. `pnpm --filter @repo/db prisma:migrate` |

## Известные ограничения (v0.9)

- **Dev-only Docker**: Dockerfile'ы (`apps/api`, `apps/web`, `apps/worker`) не имеют build-стадии и запускают `pnpm dev` внутри контейнера. Прод-образов нет.
- **Telegram-бот не входит в docker-compose** — запускается вручную.
- Healthcheck-эндпоинт только один — `GET /health` у API. В compose healthcheck настроен только у `postgres` (`pg_isready`).
- Нет reverse proxy и TLS-терминации.
- Redis-сервис в compose не публикует порт наружу; для контейнеров `api`/`worker` `REDIS_URL` переопределён на `redis://redis:6379` (см. нюанс выше).

Планы по прод-деплою и прочему недостающему функционалу — в [ROADMAP-PROMPT.md](../ROADMAP-PROMPT.md), раздел **v1.0** (прод-деплой, документация API, финальный QA).
