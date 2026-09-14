#Requires -Version 7
<#
.SYNOPSIS
    Скрипт очистки проекта university-schedule.
.DESCRIPTION
    Останавливает Docker-контейнеры, удаляет артефакты сборки,
    убивает процессы на портах 3000/3001 и (опционально) очищает node_modules.
.PARAMETER Purge
    Если указан — также удаляет node_modules и Docker volumes.
.PARAMETER PortsOnly
    Если указан — только убивает процессы на портах 3000 и 3001.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$Purge,
    [switch]$PortsOnly
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

if ($PortsOnly) {
    Write-Info "=== Остановка процессов на портах 3000 и 3001 ==="
    foreach ($port in @(3000, 3001)) {
        $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($proc) {
            try {
                Stop-Process -Id $proc.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Success "Процесс на порту $port остановлен"
            } catch {
                Write-Warn "Не удалось остановить процесс на порту $port: $_"
            }
        } else {
            Write-Host "Порт $port свободен"
        }
    }
    return
}

# 1. Docker Compose down
Write-Info "=== Остановка Docker-контейнеров ==="
$composeFile = Join-Path $projectRoot 'docker-compose.yml'
if (Test-Path $composeFile) {
    try {
        Push-Location $projectRoot
        if ($Purge) {
            if ($PSCmdlet.ShouldProcess('docker compose down -v', 'Execute')) {
                docker compose down -v | Out-Null
                Write-Success "Контейнеры остановлены и volumes удалены"
            }
        } else {
            if ($PSCmdlet.ShouldProcess('docker compose down', 'Execute')) {
                docker compose down | Out-Null
                Write-Success "Контейнеры остановлены"
            }
        }
        Pop-Location
    } catch {
        Write-Warn "Ошибка при остановке Docker: $_"
    }
} else {
    Write-Warn "docker-compose.yml не найден"
}

# 2. Артефакты сборки (.turbo, dist)
Write-Info "=== Удаление артефактов сборки ==="
$artifacts = @(
    (Join-Path $projectRoot '.turbo')
)
# Поиск dist в apps и packages
$artifacts += Get-ChildItem -Path $projectRoot -Directory -Recurse -Depth 3 -Filter 'dist' | Select-Object -ExpandProperty FullName

foreach ($art in $artifacts) {
    if (Test-Path $art) {
        if ($PSCmdlet.ShouldProcess($art, 'Remove')) {
            Remove-Item $art -Recurse -Force
            Write-Success "Удалено: $art"
        }
    }
}
Write-Success "Артефакты сборки очищены"

# 3. Убить процессы на портах
Write-Info "=== Проверка портов 3000 и 3001 ==="
foreach ($port in @(3000, 3001)) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Success "Процесс на порту $port остановлен"
        } catch {
            Write-Warn "Не удалось остановить процесс на порту $port: $_"
        }
    } else {
        Write-Host "Порт $port свободен"
    }
}

# 4. Очистка node_modules (только с -Purge)
if ($Purge) {
    Write-Info "=== Удаление node_modules (Purge) ==="
    $modulesPaths = Get-ChildItem -Path $projectRoot -Directory -Recurse -Depth 4 -Filter 'node_modules' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
    foreach ($mod in $modulesPaths) {
        if ($PSCmdlet.ShouldProcess($mod, 'Remove')) {
            Remove-Item $mod -Recurse -Force
            Write-Success "Удалено: $mod"
        }
    }
    Write-Success "node_modules удалены"
} else {
    Write-Host "Для удаления node_modules запустите с флагом -Purge"
}

Write-Info "=== Очистка завершена ==="
