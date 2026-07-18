#Requires -Version 5.1
#Requires -Modules @{ ModuleName="Microsoft.PowerShell.Management"; ModuleVersion="3.1.0.0" }
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$frontend = Join-Path $root "frontend"
$backend = Join-Path $root "backend"
$electron = Join-Path $root "electron"
$backendStatic = Join-Path $backend "static" "dist"
$electronResources = Join-Path $electron "resources"

# 1. 生成图标
Write-Host "[1/6] Generating icons..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$root\scripts\generate-icons.ps1"

# 2. 构建前端
Write-Host "[2/6] Building frontend..."
Set-Location $frontend
pnpm install
pnpm build

# 3. 复制前端产物到后端 static/dist
Write-Host "[3/6] Copying frontend dist to backend/static/dist..."
if (Test-Path $backendStatic) {
    Remove-Item $backendStatic -Recurse -Force
}
New-Item -ItemType Directory -Path $backendStatic -Force | Out-Null
Copy-Item -Path "$frontend\dist\*" -Destination $backendStatic -Recurse -Force

# 4. 清理并重建 electron/resources
Write-Host "[4/6] Preparing electron/resources..."
if (Test-Path $electronResources) {
    Remove-Item $electronResources -Recurse -Force
}
New-Item -ItemType Directory -Path $electronResources -Force | Out-Null

# 5. PyInstaller 打包后端
Write-Host "[5/6] Building backend with PyInstaller..."
Set-Location $backend
uv sync
uv run --with pyinstaller pyinstaller `
    --name ghost-flow-backend `
    --onefile `
    --add-data "static/dist;static/dist" `
    --add-data "alembic;alembic" `
    --add-data "alembic.ini;." `
    --distpath $electronResources `
    --clean `
    desktop_entry.py

# 6. Electron 打包
Write-Host "[6/6] Building electron installer..."
Set-Location $electron
pnpm install
pnpm dist

$installer = Join-Path $electron "dist-electron" "Ghost Flow Work App Setup 0.1.0.exe"
if (Test-Path $installer) {
    Write-Host "Build complete: $installer" -ForegroundColor Green
} else {
    Write-Error "Installer not found at $installer"
}
