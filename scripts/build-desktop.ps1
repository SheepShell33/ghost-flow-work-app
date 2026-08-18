#Requires -Version 5.1
#Requires -Modules @{ ModuleName="Microsoft.PowerShell.Management"; ModuleVersion="3.1.0.0" }
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$frontend = Join-Path $root "frontend"
$backend = Join-Path $root "backend"
$electron = Join-Path $root "electron"
$backendStatic = Join-Path (Join-Path $backend "static") "dist"
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

# 4. 准备 electron/resources（仅移除旧后端可执行文件，保留其他资源，并确保 uv.exe 存在）
Write-Host "[4/6] Preparing electron/resources..."
if (-not (Test-Path $electronResources)) {
    New-Item -ItemType Directory -Path $electronResources -Force | Out-Null
}
$backendExe = Join-Path $electronResources "ghost-flow-backend.exe"
if (Test-Path $backendExe) {
    Remove-Item $backendExe -Force
}

# 确保打包产物包含 uv.exe：优先复制本机 uv，否则下载匹配版本
$uvDest = Join-Path $electronResources "uv.exe"
$localUv = (Get-Command uv -ErrorAction SilentlyContinue).Source
if ($localUv) {
    Write-Host "使用本地 uv.exe: $localUv"
    Copy-Item $localUv $uvDest -Force
} else {
    Write-Host "未找到本地 uv，开始下载 uv.exe..."
    $uvVersion = "0.11.28"
    $uvUrl = "https://github.com/astral-sh/uv/releases/download/$uvVersion/uv-x86_64-pc-windows-msvc.zip"
    $zip = "$env:TEMP\uv-$uvVersion.zip"
    Invoke-WebRequest -Uri $uvUrl -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath "$env:TEMP\uv-$uvVersion" -Force
    Copy-Item "$env:TEMP\uv-$uvVersion\uv.exe" $uvDest -Force
}
if (-not (Test-Path $uvDest)) {
    throw "uv.exe 准备失败"
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

$electronPackage = Get-Content "$electron\package.json" -Raw | ConvertFrom-Json
# productName 位于 build 字段内；version 在顶层
$productName = $electronPackage.build.productName
$version = $electronPackage.version
$distDir = Join-Path $electron "dist-electron"
$artifacts = @(
    "$productName Setup $version.exe",   # NSIS 安装包
    "$productName $version.exe"          # 便携版单文件
)
$missing = @()
foreach ($name in $artifacts) {
    $artifact = Join-Path $distDir $name
    if (Test-Path $artifact) {
        Write-Host "Build complete: $artifact" -ForegroundColor Green
    } else {
        $missing += $artifact
    }
}
if ($missing.Count -gt 0) {
    Write-Error "Artifact not found: $($missing -join ', ')"
}
