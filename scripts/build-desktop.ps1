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
if ($LASTEXITCODE -ne 0) { throw "Icon generation failed with exit code $LASTEXITCODE" }

# 2. 构建前端
Write-Host "[2/6] Building frontend..."
Set-Location $frontend
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install (frontend) failed with exit code $LASTEXITCODE" }
pnpm build
if ($LASTEXITCODE -ne 0) { throw "pnpm build failed with exit code $LASTEXITCODE" }

# 3. 复制前端产物到后端 static/dist
Write-Host "[3/6] Copying frontend dist to backend/static/dist..."
$frontendDist = Join-Path $frontend "dist"
if (-not (Test-Path $frontendDist) -or -not (Get-ChildItem $frontendDist -Force)) {
    throw "frontend/dist does not exist or is empty"
}
if (Test-Path $backendStatic) {
    Remove-Item $backendStatic -Recurse -Force
}
New-Item -ItemType Directory -Path $backendStatic -Force | Out-Null
Copy-Item -Path "$frontendDist\*" -Destination $backendStatic -Recurse -Force

# 4. 准备 electron/resources（仅移除旧后端可执行文件，保留其他资源）
Write-Host "[4/6] Preparing electron/resources..."
if (-not (Test-Path $electronResources)) {
    New-Item -ItemType Directory -Path $electronResources -Force | Out-Null
}
$backendExe = Join-Path $electronResources "ghost-flow-backend.exe"
if (Test-Path $backendExe) {
    Remove-Item $backendExe -Force
}

# 5. PyInstaller 打包后端
Write-Host "[5/6] Building backend with PyInstaller..."
Set-Location $backend
uv sync
if ($LASTEXITCODE -ne 0) { throw "uv sync failed with exit code $LASTEXITCODE" }
uv run --with pyinstaller pyinstaller `
    --name ghost-flow-backend `
    --onefile `
    --add-data "static/dist;static/dist" `
    --add-data "alembic;alembic" `
    --add-data "alembic.ini;." `
    --collect-submodules app `
    --paths $backend `
    --hidden-import sqlalchemy.ext.automap `
    --hidden-import apscheduler.triggers.cron `
    --hidden-import pandas._libs.tslibs.base `
    --distpath $electronResources `
    --clean `
    desktop_entry.py
if ($LASTEXITCODE -ne 0) { throw "pyinstaller failed with exit code $LASTEXITCODE" }

# 6. Electron 打包
Write-Host "[6/6] Building electron installer..."
Set-Location $electron
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install (electron) failed with exit code $LASTEXITCODE" }
pnpm dist
if ($LASTEXITCODE -ne 0) { throw "pnpm dist failed with exit code $LASTEXITCODE" }

$electronPackage = Get-Content "$electron\package.json" | ConvertFrom-Json
$installerName = "$($electronPackage.productName) Setup $($electronPackage.version).exe"
$installer = Join-Path $electron "dist-electron" $installerName
if (Test-Path $installer) {
    Write-Host "Build complete: $installer" -ForegroundColor Green
} else {
    Write-Error "Installer not found at $installer"
}
