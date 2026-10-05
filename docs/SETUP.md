# Настройка окружения для разработки

Пошаговое руководство для запуска University Schedule System (USS) на локальной машине.

---

## 1. Системные требования

| Требование | Минимальная версия | Проверка |
|---|---|---|
| **Node.js** | 20+ | `node -v` |
| **pnpm** | 9+ | `pnpm -v` |
| **Docker** | Любая с Docker Compose v2 | `docker --version` |

> Docker нужен для PostgreSQL и Redis (dev-компоненты из `docker-compose.yml`). Если они уже подняты локально, Docker не обязателен.

### Установка pnpm

```bash
npm install -g pnpm@9
```

Или через [corepack](https://pnpm.io/installation#using-corepack):

```bash
corepack enable
corepack prepare pnpm@9 --activate
```

---

## 2. Клонирование репозитория

```bash
git clone https://github.com/x18255914022/USS.git
cd USS
```

---

## 3. Установка зависимостей

```bash
pnpm install
```

Моно-репозиторий на pnpm workspaces. Все пакеты (`apps/*`, `packages/*`) установятся автоматически.

---

## 4. Переменные окружения

```bash
cp .env.example .env
```

### Обязательные переменные

| Переменная | Описание | Пример |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL (миграция с SQLite выполнена в v1.0) | `postgresql://uss:uss_dev_password@localhost:5432/uss` |
| `JWT_SECRET` | Секрет JWT (≥16 символов) | `my-super-secret-jwt-key-123` |
| `REFRESH_TOKEN_SECRET` | Секрет refresh-токена (≥16 символов) | `my-refresh-secret-key-12345` |
| `APP_URL` | URL фронтенда | `http://localhost:3000` |

### Дополнительные переменные

| Переменная | Default | Описание |
|---|---|---|
| `PORT` | `3001` | Порт API |
| `REDIS_URL` | `redis://localhost:6379` | URL Redis для очередей |
| `TELEGRAM_BOT_TOKEN` | — | Токен Telegram-бота |
| `BOT_TOKEN` | — | Service-токен для связи бот ↔ API (одинаковый в обоих) |
| `UNIVERSITY_TZ` | `UTC` | Часовой пояс (тихие часы уведомлений) |

Полный список переменных — в [docs/DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 5. PostgreSQL и Redis

### Вариант A: Docker (рекомендуется)

```bash
docker compose up -d postgres redis
```

### Вариант B: Локальные инстансы

Поднимите PostgreSQL (креды как в `docker-compose.yml`: `uss`/`uss_dev_password`, база `uss`, порт 5432) и Redis (`localhost:6379`) самостоятельно.

### Проверка

```bash
docker compose exec postgres pg_isready -U uss
docker compose exec redis redis-cli ping
# → PONG
```

---

## 6. Инициализация базы данных

```bash
# Генерация Prisma Client
pnpm --filter @repo/db prisma:generate

# Применение миграций (создаёт .db файл)
pnpm --filter @repo/db prisma:migrate

# Сидирование: роли, пользователи, справочники, демо-расписание
# (сам выполняет build перед запуском)
pnpm --filter @app/api seed
```

> Prisma Studio (GUI): `pnpm --filter @repo/db prisma:studio`

---

## 7. Запуск проекта

### Основные сервисы (web + api + worker)

```bash
pnpm dev
```

| Сервис | URL |
|---|---|
| Web (Next.js) | http://localhost:3000 |
| API (Fastify) | http://localhost:3001 |
| Bull Board | http://localhost:3001/admin/queues (нужен admin) |

### Telegram-бот (отдельно)

```bash
pnpm --filter @app/bot dev
```

Без `TELEGRAM_BOT_TOKEN` бот молча завершается — это штатное поведение.

---

## 8. Тестовые учётные записи

| Роль | Email | Пароль |
|---|---|---|
| Admin | `admin@example.com` | `admin12345` |
| Student | `student@example.com` | `student12345` |

Учётки создаются при сидировании. Переопределяются через `SEED_ADMIN_*` / `SEED_STUDENT_*`.

---

## 9. Запуск тестов

```bash
# Unit-тесты API (vitest)
pnpm --filter @app/api test:unit

# Интеграционные тесты API (vitest)
pnpm --filter @app/api test:integration

# Тесты worker (node:test)
pnpm --filter @app/worker test
```

---

## 10. Сборка для production

```bash
pnpm build
```

Turbo собирает все пакеты. Артефакты: `dist/` (api, worker, shared, db), `.next/` (web).

> Продакшн-образы с v1.0 есть: `apps/*/Dockerfile.prod` + [`docker-compose.prod.yml`](./DEPLOYMENT.md) — см. раздел «Продакшн» в DEPLOYMENT.md.

---

## 11. Автоматическая инициализация (скрипты)

Скрипты `scripts/init.sh` (Linux/macOS) и `scripts/init.ps1` (Windows, PowerShell 7) делают шаги 3–5 автоматически:

```bash
# Linux/macOS
./scripts/init.sh

# Windows
.\scripts\init.ps1
```

Флаги: `--skip-docker` / `-SkipDocker` (пропустить Redis), `--purge` / `-Purge` (очистка перед init).

> Скрипты **не** запускают миграции и seed — их нужно выполнить вручную (шаг 6).

---

## 12. Troubleshooting

| Проблема | Решение |
|---|---|
| `EADDRINUSE` на 3000/3001 | Порты заняты: `./scripts/cleanup.sh --ports-only` или вручную убейте процессы |
| API падает с Zod-ошибкой о `JWT_SECRET` | Секрет короче 16 символов или отсутствует в `.env` |
| `P2021` / «table does not exist» | Миграции не применены: `pnpm --filter @repo/db prisma:migrate` |
| `Cannot find module @repo/db` | Prisma Client не сгенерирован: `pnpm --filter @repo/db prisma:generate` |
| Seed завершается ошибкой | Seed работает с `dist/seed.js` — `pnpm --filter @app/api seed` сам делает build |
| Redis-ошибки в логах API | Redis не запущен: `docker compose up -d redis`. BullMQ ретраит подключение |
| Worker молча завершается | Нет `TELEGRAM_BOT_TOKEN` — штатное поведение, не ошибка |
| Бот не работает, хотя запущен | Проверьте `BOT_TOKEN` — должен совпадать в `.env` API и бота |
| Ошибки при смене директории | Относительный `DATABASE_URL` резолвится относительно `.env`; проверьте путь |

---

## Полезные команды (шпаргалка)

```bash
pnpm dev                                       # Запуск всех сервисов
pnpm build                                     # Production-сборка
pnpm lint                                      # Линтинг
pnpm typecheck                                 # Проверка типов
pnpm --filter @repo/db prisma:studio           # Prisma Studio
pnpm --filter @repo/db prisma:migrate          # Миграции
pnpm --filter @repo/db prisma:generate         # Regenerate Prisma Client
pnpm --filter @app/api test                    # Тесты API
pnpm --filter @app/api seed                    # Seed базы
docker compose up -d postgres redis         # Запуск PostgreSQL и Redis
docker compose logs -f api                     # Логи API
docker compose down                            # Остановка контейнеров
./scripts/cleanup.sh                           # Очистка (Linux/macOS)
.\scripts\cleanup.ps1                          # Очистка (Windows)
```
