#Requires -Version 7
<#
.SYNOPSIS
    Скрипт инициализации проекта university-schedule.
.DESCRIPTION
    Проверяет зависимости, устанавливает пакеты, генерирует Prisma Client,
    поднимает Docker-инфраструктуру (Redis, PostgreSQL) и выводит финальные инструкции.
.PARAMETER SkipDocker
    Пропустить запуск Docker Compose (если Redis/PostgreSQL уже работают).
.PARAMETER Purge
    Сначала выполнить cleanup.ps1 с полной очисткой.
#>
[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$Purge
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# 1. Опциональная очистка
if ($Purge) {
    Write-Info "=== Запуск cleanup.ps1 -Purge ==="
    $cleanupScript = Join-Path $PSScriptRoot 'cleanup.ps1'
    if (Test-Path $cleanupScript) {
        & $cleanupScript -Purge
    } else {
        Write-Warn "cleanup.ps1 не найден, пропускаем очистку"
    }
}

# 2. Проверка зависимостей
Write-Info "=== Проверка зависимостей ==="
if (-not (Test-Command 'pnpm')) {
    Write-Error "pnpm не найден. Установите: https://pnpm.io/installation"
    exit 1
}
if (-not (Test-Command 'docker')) {
    Write-Error "Docker не найден. Установите Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
}
if (-not $SkipDocker) {
    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker демон не запущен. Запустите Docker Desktop."
        exit 1
    }
}
Write-Success "Все зависимости на месте"

# 3. Установка npm-пакетов
Write-Info "=== Установка зависимостей (pnpm install) ==="
Push-Location $projectRoot
$nodeModulesRoot = Join-Path $projectRoot 'node_modules'
if (Test-Path $nodeModulesRoot) {
    Write-Host "node_modules уже существуют, пропускаем установку. Для переустановки выполните cleanup.ps1 -Purge"
} else {
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "pnpm install завершился с ошибкой"
        exit 1
    }
    Write-Success "Зависимости установлены"
}

# 4. Prisma generate
Write-Info "=== Генерация Prisma Client ==="
$prismaSchema = Join-Path $projectRoot 'packages' 'db' 'prisma' 'schema.prisma'
if (Test-Path $prismaSchema) {
    pnpm --filter "@repo/db" run prisma:generate
    if ($LASTEXITCODE -ne 0) {
        Write-Error "prisma:generate завершился с ошибкой"
        exit 1
    }
    Write-Success "Prisma Client сгенерирован"
} else {
    Write-Warn "schema.prisma не найден: $prismaSchema"
}

# 5. Docker Compose up (redis + postgres)
if (-not $SkipDocker) {
    Write-Info "=== Запуск инфраструктуры (Docker Compose) ==="
    docker compose up -d redis postgres
    if ($LASTEXITCODE -ne 0) {
        Write-Error "docker compose up завершился с ошибкой"
        exit 1
    }
    Start-Sleep -Seconds 2
    Write-Success "Redis и PostgreSQL запущены в Docker"
} else {
    Write-Info "=== Docker Compose пропущен (флаг -SkipDocker) ==="
}

# 6. Финальные инструкции
Write-Info "================================================="
Write-Success "       Проект инициализирован!       "
Write-Info "================================================="
Write-Host ""
Write-Host "Для запуска всех приложений в dev-режиме выполните:" -ForegroundColor White
Write-Host "  pnpm dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Или отдельно:" -ForegroundColor White
Write-Host "  pnpm --filter @app/api dev     (API на http://localhost:3001)" -ForegroundColor Yellow
Write-Host "  pnpm --filter @app/web dev     (Web на http://localhost:3000)" -ForegroundColor Yellow
Write-Host "  pnpm --filter @app/worker dev  (Worker)" -ForegroundColor Yellow
Write-Host "  pnpm --filter @app/bot dev     (Bot)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Полезные скрипты:" -ForegroundColor White
Write-Host "  .\scripts\cleanup.ps1       — остановить и очистить" -ForegroundColor Yellow
Write-Host "  .\scripts\cleanup.ps1 -Purge — полная очистка с node_modules" -ForegroundColor Yellow
Write-Host ""
Write-Host "Для работы Prisma:" -ForegroundColor White
Write-Host "  pnpm --filter @repo/db prisma:studio" -ForegroundColor Yellow
Write-Host ""
Pop-Location
