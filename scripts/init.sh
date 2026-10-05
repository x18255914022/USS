#!/usr/bin/env bash
# Скрипт инициализации проекта university-schedule (Linux/macOS)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Цвета
C_INFO="\033[36m"
C_OK="\033[32m"
C_WARN="\033[33m"
C_RESET="\033[0m"

info()  { echo -e "${C_INFO}$1${C_RESET}"; }
ok()    { echo -e "${C_OK}$1${C_RESET}"; }
warn()  { echo -e "${C_WARN}$1${C_RESET}"; }

# Парсинг аргументов
SKIP_DOCKER=false
PURGE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-docker) SKIP_DOCKER=true; shift ;;
    --purge) PURGE=true; shift ;;
    *) warn "Неизвестный аргумент: $1"; exit 1 ;;
  esac
done

# 1. Опциональная очистка
if [ "$PURGE" = true ]; then
  info "=== Запуск cleanup.sh --purge ==="
  if [ -x "$SCRIPT_DIR/cleanup.sh" ]; then
    "$SCRIPT_DIR/cleanup.sh" --purge
  else
    warn "cleanup.sh не найден или не исполняемый, пропускаем очистку"
  fi
fi

# 2. Проверка зависимостей
info "=== Проверка зависимостей ==="
command -v pnpm >/dev/null 2>&1 || { echo "pnpm не найден. Установите: https://pnpm.io/installation"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker не найден. Установите Docker: https://docs.docker.com/get-docker/"; exit 1; }

if [ "$SKIP_DOCKER" = false ]; then
  docker info >/dev/null 2>&1 || { echo "Docker демон не запущен. Запустите Docker."; exit 1; }
fi
ok "Все зависимости на месте"

# 3. Установка зависимостей
cd "$PROJECT_ROOT"
info "=== Установка зависимостей (pnpm install) ==="
if [ -d "node_modules" ]; then
  echo "node_modules уже существуют, пропускаем установку. Для переустановки выполните ./scripts/cleanup.sh --purge"
else
  pnpm install
  ok "Зависимости установлены"
fi

# 4. Prisma generate
info "=== Генерация Prisma Client ==="
if [ -f "packages/db/prisma/schema.prisma" ]; then
  pnpm --filter "@repo/db" run prisma:generate
  ok "Prisma Client сгенерирован"
else
  warn "schema.prisma не найден"
fi

# 5. Docker Compose up (redis + postgres)
if [ "$SKIP_DOCKER" = false ]; then
  info "=== Запуск инфраструктуры (Docker Compose) ==="
  docker compose up -d redis postgres || docker-compose up -d redis postgres
  sleep 2
  ok "Redis и PostgreSQL запущены в Docker"
else
  info "=== Docker Compose пропущен (флаг --skip-docker) ==="
fi

# 6. Вывод инструкций
info "================================================="
ok "       Проект инициализирован!       "
info "================================================="
echo ""
echo "Для запуска всех приложений в dev-режиме выполните:"
echo -e "  \033[33mpnpm dev\033[0m"
echo ""
echo "Или отдельно:"
echo -e "  \033[33mpnpm --filter @app/api dev     \033[0m(API на http://localhost:3001)"
echo -e "  \033[33mpnpm --filter @app/web dev     \033[0m(Web на http://localhost:3000)"
echo -e "  \033[33mpnpm --filter @app/worker dev  \033[0m(Worker)"
echo -e "  \033[33mpnpm --filter @app/bot dev     \033[0m(Bot)"
echo ""
echo "Полезные скрипты:"
echo -e "  \033[33m./scripts/cleanup.sh\033[0m           — остановить и очистить"
echo -e "  \033[33m./scripts/cleanup.sh --purge\033[0m   — полная очистка с node_modules"
echo ""
echo "Prisma Studio:"
echo -e "  \033[33mpnpm --filter @repo/db prisma:studio\033[0m"
echo ""
