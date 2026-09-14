#!/usr/bin/env bash
# Скрипт очистки проекта university-schedule (Linux/macOS)

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
PURGE=false
PORTS_ONLY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge|-p) PURGE=true; shift ;;
    --ports-only) PORTS_ONLY=true; shift ;;
    *) warn "Неизвестный аргумент: $1"; exit 1 ;;
  esac
done

# Только очистка портов
if [ "$PORTS_ONLY" = true ]; then
  info "=== Остановка процессов на портах 3000 и 3001 ==="
  for port in 3000 3001; do
    pid="$(lsof -t -i:"$port" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
      kill -9 "$pid" 2>/dev/null && ok "Процесс на порту $port (PID $pid) остановлен" || warn "Не удалось остановить PID $pid"
    else
      echo "Порт $port свободен"
    fi
  done
  exit 0
fi

# 1. Docker Compose down
info "=== Остановка Docker контейнеров ==="
cd "$PROJECT_ROOT"
if [ -f "docker-compose.yml" ]; then
  if [ "$PURGE" = true ]; then
    docker compose down -v || docker-compose down -v || true
    ok "Контейнеры остановлены и volumes удалены"
  else
    docker compose down || docker-compose down || true
    ok "Контейнеры остановлены"
  fi
else
  warn "docker-compose.yml не найден"
fi

# 2. Артефакты сборки
info "=== Удаление артефактов сборки ==="
rm -rf "$PROJECT_ROOT/.turbo"
find "$PROJECT_ROOT" -maxdepth 4 -type d -name "dist" -print0 | while IFS= read -r -d '' dir; do
  echo "Удалено: $dir"
  rm -rf "$dir"
done
ok "Артефакты сборки очищены"

# 3. Освобождение портов
info "=== Проверка портов 3000 и 3001 ==="
for port in 3000 3001; do
  pid="$(lsof -t -i:"$port" 2>/dev/null || true)"
  if [ -n "$pid" ]; then
    kill -9 "$pid" 2>/dev/null && ok "Процесс на порту $port (PID $pid) остановлен" || warn "Не удалось остановить PID $pid"
  else
    echo "Порт $port свободен"
  fi
done

# 4. Очистка node_modules (с --purge)
if [ "$PURGE" = true ]; then
  info "=== Удаление node_modules (Purge) ==="
  find "$PROJECT_ROOT" -maxdepth 4 -type d -name "node_modules" -print0 | while IFS= read -r -d '' dir; do
    echo "Удалено: $dir"
    rm -rf "$dir"
  done
  ok "node_modules удалены"
else
  echo "Для удаления node_modules запустите с флагом --purge"
fi

info "=== Очистка завершена ==="
