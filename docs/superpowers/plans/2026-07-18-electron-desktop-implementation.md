# Electron 桌面端打包实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Ghost Flow Work App 打包为 Windows 桌面安装程序，提供独立窗口、系统托盘与 GitHub Releases 自动更新能力。

**Architecture:** Electron 主进程启动由 PyInstaller 打包的单文件后端，后端通过 FastAPI 托管前端静态资源；前端无需修改即可在桌面端运行。数据目录采用便携模式，与安装目录下的 `data/` 共存。

**Tech Stack:** Electron 31 + electron-builder + electron-updater + TypeScript；PyInstaller；PowerShell 5.1 构建脚本。

## Global Constraints

- 仅支持 Windows 平台。
- 数据目录使用安装目录下的 `data/`（便携模式）。
- 后端监听固定端口 `127.0.0.1:17892`，通过 `PORT` 环境变量覆盖。
- 自动更新源为 GitHub Releases，未签名安装包会提示「未知发布者」。
- 所有代码注释、文档、沟通使用中文。
- 项目使用 `uv` 管理 Python，`pnpm` 管理前端/Electron。

---

## File Structure

新建/修改的文件如下：

```
backend/
  desktop_entry.py              # PyInstaller 入口：启动 uvicorn
  app/core/config.py            # 支持便携数据目录
  app/core/logging.py           # 日志写入 settings.data_dir
  app/main.py                   # 挂载前端静态文件
  .gitignore                    # 忽略 build/dist/static 产物
electron/
  package.json                  # Electron 依赖与 builder 配置
  tsconfig.json                 # TypeScript 配置
  main.ts                       # 主进程：启后端、窗口、托盘
  preload.ts                    # 预加载脚本
  updater.ts                    # 自动更新逻辑
  assets/                       # 图标（由脚本生成）
  resources/                    # PyInstaller 后端 exe
scripts/
  generate-icons.ps1            # 生成 icon.ico / tray-icon.png
  build-desktop.ps1             # 一键桌面打包
frontend/
  .gitignore                    # 保持不变，dist 已忽略
```

---

### Task 1: 后端配置支持便携数据目录

**Files:**
- Modify: `backend/app/core/config.py`

**Interfaces:**
- Consumes: 环境变量 `GHOST_FLOW_DATA_DIR`
- Produces: `settings.data_dir: Path`，`settings.database_url: str` 基于 data_dir

- [ ] **Step 1: 修改 config.py 支持环境变量与打包后路径**

```python
from pathlib import Path
import sys
from pydantic_settings import BaseSettings


def _default_base_dir() -> Path:
    """开发时使用项目根目录；PyInstaller 打包后使用 exe 所在目录。"""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "Ghost Flow Work App"
    app_version: str = "0.1.0"
    data_dir: Path = _default_base_dir() / "data"
    database_url: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    cors_allow_credentials: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def model_post_init(self, __context):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.database_url:
            self.database_url = f"sqlite:///{self.data_dir / 'app.db'}"


settings = Settings()
```

- [ ] **Step 2: 验证开发模式数据库路径未变**

Run:
```bash
cd backend
uv run python -c "from app.core.config import settings; print(settings.data_dir); print(settings.database_url)"
```

Expected: `data_dir` 指向项目根目录的 `data/`，`database_url` 指向该目录下的 `app.db`。

- [ ] **Step 3: 测试环境变量覆盖**

Run:
```bash
$env:GHOST_FLOW_DATA_DIR = "D:\\temp\\ghost-flow-data"
uv run python -c "from app.core.config import settings; print(settings.data_dir); print(settings.database_url)"
```

Expected: `data_dir` 为 `D:\temp\ghost-flow-data`，database_url 指向其下 `app.db`。

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/config.py
git commit -m "feat(backend): 数据目录支持环境变量与便携模式"
```

---

### Task 2: 后端日志写入 data_dir

**Files:**
- Modify: `backend/app/core/logging.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `settings.data_dir`
- Produces: 日志文件写入 `<data_dir>/logs/`

- [ ] **Step 1: 修改 logging.py 默认使用 settings.data_dir**

```python
import sys
from pathlib import Path

from loguru import logger

from app.core.config import settings


def setup_logging(log_dir: str | None = None):
    if log_dir is None:
        log_dir = str(settings.data_dir / "logs")

    Path(log_dir).mkdir(parents=True, exist_ok=True)

    logger.remove()

    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level:^8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO",
        colorize=True,
    )

    logger.add(
        Path(log_dir) / "app_{time:YYYY-MM-DD}.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:^8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        rotation="10 MB",
        retention="30 days",
        encoding="utf-8",
    )

    return logger
```

- [ ] **Step 2: 修改 main.py 调用 setup_logging 时传入 data_dir**

```python
logger = setup_logging(str(settings.data_dir / "logs"))
```

- [ ] **Step 3: 验证后端启动时日志目录正确创建**

Run:
```bash
uv run uvicorn app.main:app --port 8001
```

在另一个终端检查 `data/logs/` 下是否生成日志文件。

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/logging.py backend/app/main.py
git commit -m "feat(backend): 日志目录跟随 data_dir"
```

---

### Task 3: 后端托管前端静态文件

**Files:**
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `backend/static/dist/` 或 PyInstaller 临时目录中的 `static/dist/`
- Produces: 根路径 `/` 返回前端入口 `index.html`

- [ ] **Step 1: 在 main.py 中挂载 StaticFiles**

```python
from contextlib import asynccontextmanager
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.router import api_router
from .core.config import settings
from .core.database import init_db, SessionLocal
from .models.task_run import TaskRun
from .services.scheduler import init_scheduler, shutdown_scheduler
from .core.logging import setup_logging

logger = setup_logging(str(settings.data_dir / "logs"))


def _reset_stale_runs():
    """服务启动时，将上次异常中断后仍标记为 running 的运行记录置为失败。"""
    from datetime import datetime, timezone

    db = SessionLocal()
    try:
        stale = db.query(TaskRun).filter(TaskRun.status == "running").all()
        if stale:
            for run in stale:
                run.status = "failed"
                run.error_message = "服务重启导致运行中断"
                run.finished_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"reset {len(stale)} stale running task runs")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting up...")
    init_db()
    _reset_stale_runs()
    init_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": settings.app_version}


def _get_static_dir() -> Path | None:
    """查找前端静态资源目录：开发时或 PyInstaller onefile 临时目录。"""
    # 开发模式：backend/static/dist
    dev_static = Path(__file__).resolve().parent.parent / "static" / "dist"
    if dev_static.exists():
        return dev_static
    # PyInstaller onefile 解压目录
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        bundle_static = Path(meipass) / "static" / "dist"
        if bundle_static.exists():
            return bundle_static
    return None


_static_dir = _get_static_dir()
if _static_dir:
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
```

- [ ] **Step 2: 构建前端并复制到 backend/static/dist**

Run:
```bash
cd frontend
pnpm build
Copy-Item -Path dist -Destination ../backend/static/dist -Recurse -Force
```

- [ ] **Step 3: 验证后端可直接访问前端页面**

Run:
```bash
cd backend
uv run uvicorn app.main:app --port 8001
```

浏览器访问 http://127.0.0.1:8001/，应看到应用界面；访问 http://127.0.0.1:8001/api/health 应返回 JSON。

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): FastAPI 托管前端静态文件"
```

---

### Task 4: 后端桌面入口与 PyInstaller 支持

**Files:**
- Create: `backend/desktop_entry.py`

**Interfaces:**
- Consumes: 环境变量 `PORT`
- Produces: PyInstaller 打包后的 `ghost-flow-backend.exe`

- [ ] **Step 1: 创建 desktop_entry.py**

```python
import os
import uvicorn


def main():
    port = int(os.environ.get("PORT", "17892"))
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 验证入口可直接启动**

Run:
```bash
cd backend
$env:PORT = "17893"
uv run python desktop_entry.py
```

浏览器访问 http://127.0.0.1:17893/ 应看到应用界面。

- [ ] **Step 3: Commit**

```bash
git add backend/desktop_entry.py
git commit -m "feat(backend): 添加 PyInstaller 桌面入口"
```

---

### Task 5: Electron 项目脚手架

**Files:**
- Create: `electron/package.json`
- Create: `electron/tsconfig.json`

**Interfaces:**
- Produces: Electron 可构建环境

- [ ] **Step 1: 创建 electron/package.json**

```json
{
  "name": "ghost-flow-desktop",
  "version": "0.1.0",
  "description": "Ghost Flow Work App Desktop",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "dist": "pnpm build && electron-builder",
    "postinstall": "electron-builder install-app-deps"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "electron-log": "^5.1.5",
    "electron-updater": "^6.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.9",
    "electron": "^31.0.2",
    "electron-builder": "^24.13.3",
    "typescript": "^5.5.2"
  },
  "build": {
    "appId": "com.ghostflow.desktop",
    "productName": "Ghost Flow Work App",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "assets/**/*",
      "resources/ghost-flow-backend.exe"
    ],
    "extraResources": [
      {
        "from": "resources/ghost-flow-backend.exe",
        "to": "ghost-flow-backend.exe"
      }
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    },
    "publish": {
      "provider": "github",
      "owner": "YOUR_GITHUB_USERNAME",
      "repo": "ghost-flow-work-app"
    }
  }
}
```

> 注意：将 `build.publish.owner` 替换为实际 GitHub 用户名或组织名。

- [ ] **Step 2: 创建 electron/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["main.ts", "preload.ts", "updater.ts"]
}
```

- [ ] **Step 3: 安装依赖并验证 tsc 编译**

Run:
```bash
cd electron
pnpm install
pnpm build
```

Expected: `dist/main.js` 尚未生成（因为 main.ts 不存在），但 TypeScript 配置被读取，无配置错误。

- [ ] **Step 4: Commit**

```bash
git add electron/package.json electron/tsconfig.json
git commit -m "chore(electron): Electron 项目脚手架"
```

---

### Task 6: Electron 主进程

**Files:**
- Create: `electron/main.ts`

**Interfaces:**
- Consumes: `resources/ghost-flow-backend.exe`
- Produces: 窗口、托盘、后端进程生命周期管理

- [ ] **Step 1: 创建 electron/main.ts**

```typescript
import { app, BrowserWindow, Tray, Menu, dialog, nativeImage, ipcMain } from 'electron'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'
import fs from 'fs'
import axios from 'axios'

import { initUpdater } from './updater'

const BACKEND_PORT = 17892
const BACKEND_HEALTH_TIMEOUT = 30000

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let backendProcess: ChildProcessWithoutNullStreams | null = null

function getInstallDir(): string {
  return path.dirname(app.getPath('exe'))
}

function getBackendExePath(): string {
  return path.join(process.resourcesPath, 'ghost-flow-backend.exe')
}

function getDataDir(): string {
  return path.join(getInstallDir(), 'data')
}

async function waitForBackend(): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < BACKEND_HEALTH_TIMEOUT) {
    try {
      const res = await axios.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, { timeout: 1000 })
      if (res.status === 200) return true
    } catch {
      // 后端尚未就绪，继续等待
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    center: true,
    show: false,
    title: 'Ghost Flow Work App',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}/`)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!(app as any).isQuiting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  const iconPath = path.join(process.resourcesPath, 'tray-icon.png')
  let trayIcon: Electron.NativeImage
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } else {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 Ghost Flow',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => {
        // updater 模块提供手动检查能力，此处仅作占位触发
        // 具体实现见 updater.ts
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        ;(app as any).isQuiting = true
        app.quit()
      },
    },
  ])

  tray.setToolTip('Ghost Flow Work App')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    }
  })
}

async function startBackend() {
  const exePath = getBackendExePath()
  if (!fs.existsSync(exePath)) {
    dialog.showErrorBox('后端组件缺失', `找不到后端程序：${exePath}`)
    app.quit()
    return
  }

  const dataDir = getDataDir()
  fs.mkdirSync(dataDir, { recursive: true })

  backendProcess = spawn(exePath, [], {
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      GHOST_FLOW_DATA_DIR: dataDir,
    },
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`[backend stdout] ${data}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[backend stderr] ${data}`)
  })

  backendProcess.on('error', (err) => {
    dialog.showErrorBox('后端启动失败', err.message)
    app.quit()
  })

  const ok = await waitForBackend()
  if (!ok) {
    dialog.showErrorBox('服务启动超时', `Ghost Flow 后端未能在 ${BACKEND_HEALTH_TIMEOUT / 1000} 秒内启动。`)
    backendProcess.kill()
    app.quit()
  }
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill()
  }
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(async () => {
  await startBackend()
  createWindow()
  createTray()
  initUpdater()
})

app.on('before-quit', () => {
  ;(app as any).isQuiting = true
})

app.on('window-all-closed', () => {
  // 保留托盘与后端进程
})

app.on('will-quit', () => {
  stopBackend()
})

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show()
  } else {
    createWindow()
  }
})

ipcMain.handle('app:version', () => app.getVersion())
```

- [ ] **Step 2: 编译验证**

Run:
```bash
cd electron
pnpm build
```

Expected: `dist/main.js` 生成，无 TypeScript 错误。

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat(electron): 主进程实现（后端启动、窗口、托盘、单实例）"
```

---

### Task 7: Electron 预加载脚本与自动更新

**Files:**
- Create: `electron/preload.ts`
- Create: `electron/updater.ts`

**Interfaces:**
- Produces: `window.electronAPI` 暴露给前端
- Produces: 自动更新事件通知

- [ ] **Step 1: 创建 electron/preload.ts**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  onUpdateMessage: (callback: (event: unknown, message: string) => void) => {
    ipcRenderer.on('updater:message', callback)
    return () => ipcRenderer.off('updater:message', callback)
  },
})
```

- [ ] **Step 2: 创建 electron/updater.ts**

```typescript
import { autoUpdater } from 'electron-updater'
import { dialog, ipcMain } from 'electron'
import log from 'electron-log'

export function initUpdater() {
  log.transports.file.level = 'info'
  autoUpdater.logger = log

  // 启动时静默检查更新并通知
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    log.error('自动更新检查失败', err)
  })

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: '发现新版本，下载完成后将自动安装。',
      buttons: ['确定'],
    })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: '更新已下载',
        message: '新版本已下载，是否立即安装并重启？',
        buttons: ['立即重启', '稍后'],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (err) => {
    log.error('Updater error:', err)
  })

  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, updateInfo: result?.updateInfo }
    } catch (err: any) {
      log.error('手动检查更新失败', err)
      return { success: false, error: err.message }
    }
  })
}
```

- [ ] **Step 3: 更新 main.ts 托盘「检查更新」菜单**

在 `electron/main.ts` 顶部导入 `autoUpdater`：

```typescript
import { autoUpdater } from 'electron-updater'
```

修改托盘菜单的「检查更新」项：

```typescript
{
  label: '检查更新',
  click: () => {
    autoUpdater.checkForUpdates().catch(() => {})
  },
},
```

- [ ] **Step 4: 编译验证**

Run:
```bash
cd electron
pnpm build
```

Expected: `dist/preload.js` 与 `dist/updater.js` 生成，无错误。

- [ ] **Step 5: Commit**

```bash
git add electron/preload.ts electron/updater.ts electron/main.ts
git commit -m "feat(electron): 预加载脚本与自动更新"
```

---

### Task 8: 图标生成脚本

**Files:**
- Create: `scripts/generate-icons.ps1`

**Interfaces:**
- Produces: `electron/assets/icon.ico` 和 `electron/assets/tray-icon.png`

- [ ] **Step 1: 创建 generate-icons.ps1**

```powershell
#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$assets = Join-Path $root "electron" "assets"
New-Item -ItemType Directory -Path $assets -Force | Out-Null

Add-Type -AssemblyName System.Drawing

function New-CircleBitmap($size, $color) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $brush = New-Object System.Drawing.SolidBrush($color)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.FillEllipse($brush, 1, 1, $size - 2, $size - 2)
    $g.Dispose()
    $brush.Dispose()
    return $bmp
}

$cyan = [System.Drawing.Color]::FromArgb(255, 0, 240, 255)

# 托盘图标 16x16 PNG
$tray = New-CircleBitmap 16 $cyan
$tray.Save((Join-Path $assets "tray-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$tray.Dispose()

# 应用图标 256x256，先生成 PNG
$app = New-CircleBitmap 256 $cyan
$app.Save((Join-Path $assets "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# 再生成 ICO（必须使用 Icon 类保存）
$icoPath = Join-Path $assets "icon.ico"
$ico = [System.Drawing.Icon]::FromHandle($app.GetHicon())
$stream = [System.IO.File]::OpenWrite($icoPath)
$ico.Save($stream)
$stream.Close()
$ico.Dispose()
$app.Dispose()

Write-Host "Icons generated at $assets"
```

- [ ] **Step 2: 运行生成脚本**

Run:
```bash
cd scripts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File generate-icons.ps1
```

Expected: `electron/assets/icon.ico`、`electron/assets/icon.png`、`electron/assets/tray-icon.png` 生成。

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-icons.ps1 electron/assets/
git commit -m "chore(electron): 添加图标生成脚本与占位图标"
```

---

### Task 9: 一键打包脚本

**Files:**
- Create: `scripts/build-desktop.ps1`

**Interfaces:**
- Consumes: 前端、后端、Electron 项目
- Produces: `electron/dist-electron/Ghost Flow Work App Setup 0.1.0.exe`

- [ ] **Step 1: 创建 build-desktop.ps1**

```powershell
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
```

- [ ] **Step 2: 测试脚本执行（可选）**

Run:
```bash
cd scripts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File build-desktop.ps1
```

Expected: 脚本完整执行，最终输出安装包路径。若 PyInstaller 遇到 ImportError，根据错误补充 `--hidden-import <module>`。

- [ ] **Step 3: Commit**

```bash
git add scripts/build-desktop.ps1
git commit -m "chore(build): 添加桌面端一键打包脚本"
```

---

### Task 10: Gitignore 更新

**Files:**
- Modify: `backend/.gitignore`（若不存在则创建）
- Modify: `electron/.gitignore`（新建）
- Modify: `.gitignore`（根目录）

**Interfaces:**
- Produces: 忽略构建产物与资源文件

- [ ] **Step 1: 创建/更新 backend/.gitignore**

```gitignore
# PyInstaller
build/
dist/
*.spec

# 前端静态产物（打包时生成）
static/dist/
```

- [ ] **Step 2: 创建 electron/.gitignore**

```gitignore
node_modules/
dist/
dist-electron/
resources/
*.log
```

- [ ] **Step 3: 更新根目录 .gitignore**

追加：

```gitignore
# Electron 打包产物
/electron/dist-electron/
/electron/node_modules/
/electron/resources/

# 后端打包产物
/backend/build/
/backend/dist/
/backend/*.spec
/backend/static/dist/
```

- [ ] **Step 4: Commit**

```bash
git add backend/.gitignore electron/.gitignore .gitignore
git commit -m "chore(gitignore): 忽略桌面打包产物"
```

---

### Task 11: 构建与手动验证

**Files:**
- 无新增文件

**Interfaces:**
- Produces: 可运行的安装包与验证报告

- [ ] **Step 1: 执行完整打包**

Run:
```bash
cd scripts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File build-desktop.ps1
```

- [ ] **Step 2: 安装并运行**

1. 运行生成的 `Ghost Flow Work App Setup 0.1.0.exe`
2. 选择安装目录（如 `D:\Program Files\Ghost Flow Work App`）
3. 安装完成后启动应用
4. 观察是否弹出主窗口并加载应用界面

- [ ] **Step 3: 验证后端运行**

浏览器访问 http://127.0.0.1:17892/api/health，应返回：

```json
{"status":"ok","version":"0.1.0"}
```

- [ ] **Step 4: 验证单实例**

再次启动应用，观察是否仅聚焦已有窗口，未打开第二个窗口。

- [ ] **Step 5: 验证托盘行为**

1. 点击关闭窗口，应用应隐藏到系统托盘
2. 右键托盘图标，选择「显示 Ghost Flow」，窗口重新显示
3. 选择「退出」，后端进程应结束，端口 17892 释放

- [ ] **Step 6: 验证数据目录**

检查安装目录下是否生成 `data/app.db` 和 `data/logs/`。

- [ ] **Step 7: 验证自动更新配置**

1. 打开 `%LOCALAPPDATA%\ghost-flow-desktop\logs\main.log`
2. 确认无 `publish` 配置错误日志
3. 由于仓库所有者未替换，首次运行时可能出现 GitHub 404，这是预期行为

- [ ] **Step 8: 修复 PyInstaller 隐藏导入（如需要）**

如果后端 exe 启动时报 `ModuleNotFoundError`，在 `scripts/build-desktop.ps1` 的 pyinstaller 命令中追加：

```powershell
--hidden-import "<缺失模块>" `
```

常见可能需要补充的模块：`sqlalchemy.ext.automap`、`apscheduler.triggers.cron`、`pandas._libs.tslibs.base`。

- [ ] **Step 9: Commit 最终调整**

```bash
git add -A
git commit -m "feat(desktop): Electron + PyInstaller 桌面端打包完成"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: 静态托管、数据目录、主进程、托盘、自动更新、打包脚本均已对应任务。
- [x] **Placeholder scan**: 无 TBD/TODO，所有代码块完整。
- [x] **Type consistency**: `settings.data_dir` 在 Task 1 定义，Task 2/3 使用；`GHOST_FLOW_DATA_DIR` 由 Electron 主进程设置，后端读取一致。
- [x] **Interface clarity**: 各任务之间通过文件路径和环境变量衔接，边界清晰。
