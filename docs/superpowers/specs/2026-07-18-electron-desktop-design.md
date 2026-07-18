# Ghost Flow 桌面端打包设计

## 背景

Ghost Flow Work App 当前为 Web 应用：

- 后端：FastAPI + Python 3.12 + SQLite + APScheduler
- 前端：React 19 + TypeScript + Ant Design 6 + Vite
- 开发模式：前后端分别启动，前端通过 Vite proxy 访问后端 `/api`

目标：将其打包为 Windows 桌面可执行程序，提供窗口、任务栏、系统托盘、自动更新等原生体验。

## 决策结论

采用 **Electron + PyInstaller onefile** 方案：

- 后端用 PyInstaller 打包为单个 `ghost-flow-backend.exe`
- Electron 主进程启动后端子进程，加载本地前端页面
- 使用 `electron-builder` 生成 NSIS 安装包
- 自动更新基于 GitHub Releases + `electron-updater`
- 数据目录采用**便携模式**：与可执行文件同目录下的 `data/`
- 仅支持 Windows 平台

## 1. 整体架构

```
ghost-flow-work-app/
├── backend/                    # FastAPI 后端
├── frontend/                   # React 前端
├── electron/                   # Electron 桌面壳（新增）
│   ├── package.json            # Electron 依赖与 electron-builder 配置
│   ├── main.ts                 # 主进程
│   ├── preload.ts              # 预加载脚本
│   ├── updater.ts              # 自动更新逻辑
│   └── assets/                 # 图标、托盘图标
├── scripts/
│   └── build-desktop.ps1       # Windows 一键打包脚本
└── docs/superpowers/specs/
    └── 2026-07-18-electron-desktop-design.md
```

### 构建流水线

1. `pnpm build` 构建前端 → `frontend/dist/`
2. 复制 `frontend/dist/` → `backend/static/dist/`
3. PyInstaller 打包后端 → `dist/ghost-flow-backend.exe`
4. 复制后端 exe → `electron/resources/ghost-flow-backend.exe`
5. `electron-builder` 打包 → `dist-electron/Ghost Flow Work App Setup 0.1.0.exe`

### 运行时流程

1. 用户双击桌面快捷方式启动 Electron
2. Electron 主进程获取单实例锁；若已有实例，则聚焦已有窗口并退出
3. 主进程启动 `ghost-flow-backend.exe` 子进程，监听 `127.0.0.1:17892`
4. 主进程轮询 `http://127.0.0.1:17892/api/health`，最多等待 30 秒
5. 健康检查通过后创建主窗口，加载 `http://127.0.0.1:17892/`
6. 后端通过 `StaticFiles` 托管前端资源，API 走 `/api/*`
7. 用户点击关闭窗口时，隐藏窗口到系统托盘，后端继续运行
8. 用户右键托盘图标选择「退出」，结束后端子进程并退出应用

## 2. 后端改造

### 2.1 静态文件托管

`backend/app/main.py` 增加：

```python
from fastapi.staticfiles import StaticFiles
from pathlib import Path

static_dir = Path(__file__).resolve().parent.parent / "static" / "dist"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
```

注意：`/api/*` 路由需在挂载 `StaticFiles` 之前注册，避免被静态文件覆盖。

### 2.2 数据目录配置

`backend/app/core/config.py` 支持环境变量覆盖：

- `GHOST_FLOW_DATA_DIR`：数据目录路径，默认使用可执行文件所在目录下的 `data/`
- `PORT`：后端监听端口，默认 `17892`

在 PyInstaller 打包后，`sys.executable` 指向 exe，因此数据目录通过 `Path(sys.executable).parent / "data"` 计算。但在 Electron 桌面壳中，由主进程统一设置环境变量 `GHOST_FLOW_DATA_DIR` 为安装目录（即主程序 `Ghost Flow Work App.exe` 所在目录）下的 `data/`，后端直接使用该变量，避免去猜测 exe 位置。

### 2.3 CORS 配置

生产环境下前端与后端同域，CORS 不再关键。保留现有 CORS 配置，但允许通过环境变量扩展 `cors_origins`。

### 2.4 日志路径

日志写入 `GHOST_FLOW_DATA_DIR/logs/app_*.log`，与数据库同目录，便于用户备份或排查。

## 3. Electron 主进程设计

`electron/main.ts` 职责：

### 3.1 单实例锁

```ts
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
```

### 3.2 后端子进程管理

- 从 `process.resourcesPath` 定位 `ghost-flow-backend.exe`
- 设置环境变量：
  - `PORT=17892`
  - `GHOST_FLOW_DATA_DIR=<install-dir>/data`，其中 `<install-dir>` 是主程序 `Ghost Flow Work App.exe` 所在目录，便于用户备份或迁移
- 使用 `spawn` 启动，捕获 stdout/stderr 写入 Electron 日志
- 应用退出时调用 `backendProcess.kill()` 结束后端

### 3.3 健康检查

后端启动后，主进程每 500ms 请求一次 `/api/health`，最多 30 秒。超时则显示错误弹窗并退出。

### 3.4 窗口行为

- 启动尺寸：1400x900，居中，可缩放
- 标题栏显示应用名称和版本
- 关闭窗口时不退出，调用 `mainWindow.hide()` 最小化到托盘
- 点击托盘图标可重新显示窗口

### 3.5 系统托盘

托盘图标放在 `electron/assets/tray-icon.ico`。右键菜单：

- 显示 Ghost Flow
- 检查更新
- 退出

### 3.6 IPC 通道

`electron/preload.ts` 暴露安全 API：

```ts
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  onUpdateMessage: (cb) => ipcRenderer.on('updater:message', cb),
})
```

前端可通过 `window.electronAPI` 检测是否在桌面环境，并显示「检查更新」按钮等桌面专属功能。

## 4. 自动更新

使用 `electron-updater` + GitHub Releases：

- `electron/package.json` 配置 `publish` 字段指向 GitHub 仓库
- 每次发版时创建 GitHub Release，上传 `.exe` 安装包
- 应用启动后自动静默检查更新；发现更新时弹出提示，用户确认后下载并安装
- 提供「检查更新」菜单项，允许手动触发

注意：Windows 下未签名的安装包会提示「未知发布者」，这是预期行为。如需消除，需购买代码签名证书。

## 5. 前端适配

`frontend/src/api/client.ts` 保持 `baseURL: '/api'`，因为桌面端前端从后端同域加载，无需修改。

可选增强：

- 在「关于」页面显示 `window.electronAPI?.getAppVersion()`
- 若存在 `window.electronAPI`，显示「检查更新」按钮

## 6. 打包脚本

`scripts/build-desktop.ps1` 实现一键打包：

```powershell
# 1. 构建前端
cd frontend
pnpm build

# 2. 复制前端产物到后端 static
copy ../frontend/dist ../backend/static/dist -Recurse -Force

# 3. PyInstaller 打包后端
cd ../backend
uv run pyinstaller `
  --name ghost-flow-backend `
  --onefile `
  --add-data "static/dist;static/dist" `
  --add-data "alembic;alembic" `
  --add-data "alembic.ini;." `
  --distpath ../electron/resources `
  main.py

# 4. Electron 打包
cd ../electron
pnpm install
pnpm dist
```

最终产物：`electron/dist/Ghost Flow Work App Setup 0.1.0.exe`

## 7. 错误处理

| 场景 | 处理方式 |
|---|---|
| 后端 exe 不存在 | 启动时弹窗提示「后端组件缺失」并退出 |
| 后端启动失败 | 读取 stderr，弹窗显示错误信息 |
| 健康检查超时（30s） | 弹窗提示「服务启动超时」并结束后端进程 |
| 后端端口被占用 | 主进程指定固定端口，若被占用则弹窗提示 |
| 自动更新失败 | 记录日志，不阻断应用使用 |
| 前端脚本错误 | 保留现有 ErrorBoundary，记录到控制台 |

## 8. 测试策略

- 构建脚本在 Windows 上完整跑通
- 安装包安装后能正常启动并显示窗口
- `/api/health` 返回 `ok`
- 关闭窗口后托盘保留，后端进程仍在
- 托盘「退出」后后端进程结束
- 单实例：第二次启动时聚焦已有窗口
- 自动更新配置读取正确（不测试真实下载）

## 9. 后续可扩展

- 增加开机自启选项
- 增加最小化到托盘的开关设置
- 支持 macOS / Linux 构建
- 代码签名证书消除 Windows 安全警告
