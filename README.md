# Ghost Flow Work App

一个基于 Web 的任务计划调度工具，支持定时运行 Python 脚本和 SQL 查询，可连接 SQLite 和 AWS Redshift（支持 Azure AD 浏览器 SSO、IAM 密钥、用户名密码三种认证方式），同时提供 Electron 桌面应用打包。

## 功能列表

- **连接管理**：保存 SQLite / Redshift 数据库连接配置，结构化表单按认证方式动态展示字段，支持"测试连接"（`POST /api/connections/test`）。
- **任务管理**：创建 SQL / Python 任务，支持标签筛选、前置任务依赖（`prerequisite_task_id`）、上传 `.sql` / `.py` 文件自动建任务；前置任务成功后会自动触发后置任务，支持多级任务链。
- **调度管理**：基于 APScheduler + SQLAlchemyJobStore 的 Cron 定时调度，任务级启停。
- **执行历史**：完整记录每次运行（状态、行数、耗时、错误信息），运行中的任务可真正取消（终止 Python 子进程 / SQL 执行线程）。
- **数据预览与 CSV 导出**：SQL 任务预览前 100 行，支持导出到服务器路径或直接下载 CSV。
- **依赖自动安装**：Python 任务执行前自动解析 `import` 语句并 pip 安装缺失依赖（内置 `sklearn→scikit-learn` 等导入名映射），安装失败会明确报错。

---

## 技术栈与目录结构

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Ant Design 6 + Vite |
| 后端 | FastAPI + Python 3.12 + SQLAlchemy 2.0 |
| 包管理 | uv（后端 Python）/ pnpm（前端、Electron） |
| 调度引擎 | APScheduler + SQLAlchemyJobStore |
| SQL 执行 | redshift-connector / SQLAlchemy |
| 应用数据库 | SQLite（零配置，`data/app.db`） |
| 数据库迁移 | Alembic |
| 桌面封装 | Electron 31 + electron-builder（NSIS） |
| 后端打包 | PyInstaller（onefile 单文件 exe） |

```
ghost-flow-work-app/
├── backend/                        # FastAPI 后端
│   ├── alembic/                    # 数据库迁移脚本
│   ├── alembic.ini                 # Alembic 配置
│   ├── app/
│   │   ├── main.py                 # FastAPI 入口
│   │   ├── core/                   # 配置、数据库、日志
│   │   ├── models/                 # ORM 模型
│   │   ├── schemas/                # Pydantic 校验
│   │   ├── api/endpoints/          # REST API 路由
│   │   └── services/
│   │       ├── connector/          # 数据库连接器（SQLite / Redshift）
│   │       ├── executor/           # SQL / Python 执行引擎
│   │       ├── scheduler.py        # APScheduler 调度管理
│   │       ├── task_runner.py      # 任务执行编排
│   │       ├── run_tracker.py      # 运行时任务追踪与取消
│   │       ├── csv_exporter.py     # CSV 导出
│   │       ├── data_preview.py     # 数据预览
│   │       └── deps_installer.py   # Python 依赖自动安装
│   ├── tests/                      # pytest 测试
│   ├── static/dist/                # 前端构建产物（Electron 模式由后端托管）
│   ├── desktop_entry.py            # PyInstaller 打包入口
│   ├── ghost-flow-backend.spec     # PyInstaller spec
│   └── pyproject.toml
├── frontend/                       # React + Vite 前端
│   └── src/
│       ├── api/                    # API 调用封装
│       ├── components/             # 公共组件（AppLayout 等）
│       └── pages/                  # 页面（Dashboard / Connections / Tasks / Schedules / History）
├── electron/                       # Electron 桌面壳
│   ├── main.ts                     # 主进程（启动后端 exe、窗口、托盘、自动更新）
│   ├── preload.ts                  # 预加载脚本
│   ├── updater.ts                  # electron-updater 自动更新
│   ├── assets/                     # 图标（generate-icons.ps1 生成）
│   ├── resources/                  # ghost-flow-backend.exe（PyInstaller 产物）
│   └── package.json                # electron-builder 配置，产物输出到 dist-electron/
├── scripts/
│   ├── build-desktop.ps1           # 一键桌面打包脚本
│   └── generate-icons.ps1          # 生成托盘/应用图标
├── data/                           # 运行时数据（SQLite、日志）
├── plan.md                         # 项目计划文档
├── AGENTS.md                       # AI 编码代理指南
└── README.md
```

---

## 如何运行

本应用有三种运行方式：开发模式（前后端分离，热重载）、生产模式（后端单服务托管前端）、桌面版（Electron 安装包）。

环境要求：Python 3.12+、Node.js 20+、[uv](https://docs.astral.sh/uv/)、pnpm（`npm i -g pnpm`）。

### 方式一：开发模式（日常开发）

```bash
# 终端 1：后端（端口 8000，代码改动自动重载）
cd backend
uv sync
uv run alembic upgrade head                      # 新环境首次执行，初始化数据库
uv run uvicorn app.main:app --reload --port 8000

# 终端 2：前端（端口 5173，热更新）
cd frontend
pnpm install
pnpm dev
```

浏览器访问 http://localhost:5173 ，前端通过 Vite proxy 把 `/api/*` 转发到后端 8000 端口。

### 方式二：生产模式（后端单服务）

把前端构建产物交给后端托管，只需启动一个进程：

```bash
# 1. 构建前端并复制到后端静态目录
cd frontend
pnpm install && pnpm build
mkdir -p ../backend/static/dist && cp -r dist/* ../backend/static/dist/

# 2. 启动后端（检测到 backend/static/dist 存在即自动托管前端页面）
cd ../backend
uv sync
uv run alembic upgrade head    # 首次运行初始化数据库
uv run uvicorn app.main:app --port 8000
```

浏览器访问 http://localhost:8000 即可使用完整应用（API 与页面同源，无跨域问题）。

### 方式三：桌面版（Electron 安装包）

使用打包好的安装包（打包方法见下节）：

1. 运行 `Ghost Flow Work App Setup <version>.exe`，按向导选择安装目录完成安装。
2. 从桌面快捷方式或开始菜单启动「Ghost Flow Work App」。
3. 启动后 Electron 会自动拉起内嵌的后端服务（`127.0.0.1:17892`）并打开主窗口；关闭窗口后应用最小化到系统托盘继续运行（定时任务不受影响），右键托盘图标可打开窗口或退出。
4. 数据（SQLite 数据库、日志）保存在安装目录下的 `data/` 文件夹（由环境变量 `GHOST_FLOW_DATA_DIR` 指定），卸载重装不会丢失，手动备份该目录即可迁移全部数据。
5. 应用通过 electron-updater 检查 GitHub Releases 自动更新。

### 运行测试

```bash
cd backend
uv run pytest -v
```

### 数据库迁移常用命令

```bash
cd backend
uv run alembic upgrade head   # 应用迁移
uv run alembic current        # 查看当前版本
uv run alembic stamp head     # 已有库手动标记为最新版本
```

---

## 使用手册

### 1. 创建数据库连接

左侧导航栏进入 **「连接管理」**，点击「新建连接」，选择类型后按表单字段填写。

**SQLite 连接**：只需填写数据库文件路径，对应配置 JSON：

```json
{
  "file_path": "/path/to/your/database.db"
}
```

**Redshift 连接**：先选择认证方式（`auth_type`），再填写对应字段组。

#### browser_azure — Azure AD / Entra ID 浏览器 SSO（推荐）

通过 `redshift-connector` 内置 `BrowserAzureCredentialsProvider` 完成 SSO。首次连接或点击「测试连接」时会**自动弹出系统浏览器**完成 Azure AD 登录，无需保存任何密码。

| 字段 | 必填 | 说明 |
|---|---|---|
| host | 是 | Redshift 集群地址 |
| port | 否 | 默认 5439 |
| database | 是 | 数据库名 |
| cluster_identifier | 是 | 集群标识符 |
| client_id | 是 | Azure AD 应用（客户端）ID |
| idp_tenant | 是 | Azure AD 租户 ID |
| region | 否 | 缺省时由连接器从 host 自动推导 |
| db_user / db_groups | 否 | 数据库用户 / 用户组 |

示例 JSON：

```json
{
  "auth_type": "browser_azure",
  "host": "xxx.redshift.amazonaws.com",
  "port": 5439,
  "database": "dev",
  "cluster_identifier": "my-cluster",
  "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "idp_tenant": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
}
```

#### iam_keys — IAM 访问密钥

使用 AWS Access Key 通过 STS 获取临时凭证：

```json
{
  "auth_type": "iam_keys",
  "host": "xxx.redshift.amazonaws.com",
  "port": 5439,
  "database": "dev",
  "cluster_identifier": "my-cluster",
  "region": "us-east-1",
  "user": "awsuser",
  "aws_access_key_id": "AKIA...",
  "aws_secret_access_key": "...",
  "session_token": "..."
}
```

`session_token` 仅在临时凭证场景下需要。历史配置中的 `auth_type: "iam"` 会自动映射为 `iam_keys`。

#### password — 用户名密码直连

```json
{
  "auth_type": "password",
  "host": "xxx.redshift.amazonaws.com",
  "port": 5439,
  "database": "dev",
  "user": "awsuser",
  "password": "..."
}
```

> 兼容说明：早期配置中的 `auth_type: "okta"`（Java Okta 插件方式）在后端仍原样保留，存量配置可继续使用；新建连接请使用上述三种方式。
>
> 无 `auth_type` 的历史配置按字段自动推断：含 `idp_tenant` → `browser_azure`；含 `user` + `password` → `password`。

**测试连接**：表单内点击「测试连接」按钮，后端执行 `SELECT 1` 验证（不落库），结果显示在表单内。注意 `browser_azure` 方式的测试会弹出系统浏览器要求 SSO 登录。

### 2. 创建任务

在 **「任务管理」** 页面点击「新建任务」：

- **SQL 任务**：粘贴 SQL 代码，选择已保存的数据库连接，可设置 CSV 导出路径。
- **Python 任务**：粘贴 Python 代码，在 subprocess 沙箱中执行；执行前自动解析 `import` 语句并 pip 安装缺失依赖（`sklearn`、`yaml`、`PIL`、`cv2`、`bs4` 等会自动映射为正确的包名），安装失败会明确报错并在结果 / 历史记录中展示。

任务还支持：

- **标签**：用于前端筛选。
- **前置任务**：指定 `prerequisite_task_id`，只有前置任务最后一次运行成功时才允许执行。
- **文件上传**：通过 `POST /api/tasks/upload` 上传 `.sql` 或 `.py` 文件自动创建任务。

**失败重试与超时（可选）**：表单「失败重试与超时」折叠面板中可配置：
- **失败重试次数**：默认 0（不重试）。执行异常导致的失败会按间隔自动重试；前置任务失败、连接/参数配置错误、手动取消不会重试。
- **重试间隔（秒）**：默认 60。
- **执行超时（秒）**：留空使用默认值（SQL 300 秒，Python 60 秒）。

每次尝试都会在「运行历史」中生成一条记录，"尝试"列显示第几次执行。

### 3. 测试运行与手动执行

任务列表操作列：

| 按钮 | 功能 |
|---|---|
| **执行** | 立即运行任务，记录到运行历史 |
| **测试** | 运行但不保存历史记录（SQL 返回前 20 行，Python 返回 stdout/stderr） |
| **预览** | SQL 任务预览前 100 行数据 |
| **导出** | 将 SQL 结果导出到任务设置的 CSV 路径 |
| **下载** | 直接下载 SQL 结果为 CSV 文件 |
| **编辑 / 删除** | 修改或删除任务 |

运行中的任务可在 **「运行历史」** 页面点击取消，后端会真正终止 Python 子进程 / SQL 执行线程。

### 4. 配置 Cron 调度

在任务编辑表单中展开 **「定时调度配置」**：

1. 输入 **Cron 表达式**（如 `0 9 * * *` 表示每天早上 9 点）。
2. 选择 **时区**（默认 `Asia/Shanghai`）。
3. 打开 **「启用调度」** 开关。

开启后 APScheduler 自动按 Cron 规则执行。在 **「调度配置」** 页面可查看所有排程任务的状态和下次执行时间。

> 说明：调度配置内嵌在任务模型中，启停通过 `/api/tasks/{id}/toggle` 控制；`/api/schedules` 仅提供只读列表与状态。

### 5. 前置任务链式触发

前置任务不仅可以用于“运行前检查”，还支持**成功后自动触发后置任务**，并形成多级传导链。

#### 示例：test 1 → test 2 → test 3

假设需要三个任务依次执行：test 1 定时拉取原始数据，test 2 在 test 1 成功后清洗数据，test 3 在 test 2 成功后生成报表。

**步骤 1：创建 test 1（定时任务）**

1. 进入 **「任务管理」** → 点击「新建任务」。
2. 填写任务名称 `test 1`，选择任务类型（SQL 或 Python），填写代码。
3. 展开 **「定时调度配置」**：
   - Cron 表达式：`0 9 * * *`（每天早上 9 点）。
   - 时区：`Asia/Shanghai`。
   - 打开 **「启用调度」** 开关。
4. 点击「创建」。

**步骤 2：创建 test 2（前置任务 = test 1）**

1. 点击「新建任务」，填写名称 `test 2` 与代码。
2. **前置任务** 下拉框选择 `#<test 1 id> test 1`。
3. **不要设置 Cron 表达式**，保持「启用调度」关闭（test 2 由 test 1 成功触发）。
4. 但需确保 **任务状态为启用**（任务列表中 test 2 的启用开关打开；只有 `enabled=true` 的后置任务才会被自动触发）。
5. 点击「创建」。

**步骤 3：创建 test 3（前置任务 = test 2）**

1. 点击「新建任务」，填写名称 `test 3` 与代码。
2. **前置任务** 下拉框选择 `#<test 2 id> test 2`。
3. 同样不设置 Cron 表达式，保持启用状态。
4. 点击「创建」。

**运行效果**

- 每天早上 9 点，test 1 按 Cron 规则执行。
- test 1 运行成功后，系统自动调度 test 2 执行（延迟约 1 秒，避免事务/锁冲突）。
- test 2 运行成功后，系统自动调度 test 3 执行。
- 如果链中任意任务失败，后续任务不会继续触发；失败任务可按配置自动重试，重试成功后再触发后续任务。

**注意事项**

- 后置任务必须 `enabled=true`，否则不会被自动触发。
- 后置任务无需设置自己的 Cron 调度；如果同时设置了 Cron，则它既会按 Cron 执行，也会在前置任务成功时被触发。
- 避免配置循环依赖（如 test 3 的前置任务再指向 test 1），否则可能形成无限触发链。

### 6. 查看历史与导出 CSV

- **「运行历史」** 页面展示所有执行记录：状态、行数、开始/结束时间、错误信息。
- SQL 任务结果可「导出」到服务器指定路径，或「下载」为本地 CSV 文件。

---

## Electron 桌面打包

桌面版架构：Electron 主进程（`electron/main.ts`）启动内嵌的 `ghost-flow-backend.exe`（监听 `127.0.0.1:17892`），窗口加载后端托管的前端静态页面；支持系统托盘常驻与 GitHub Releases 自动更新。数据目录为安装目录下的 `data/`（环境变量 `GHOST_FLOW_DATA_DIR`）。

### 打包前提

- Windows + PowerShell（脚本 `build-desktop.ps1` 为 PowerShell 语法，兼容 PowerShell 5.1）。
- 已安装 uv、pnpm、Node.js 20+、Python 3.12+（同开发环境）。
- 首次执行 electron-builder 会自动下载 Electron 与 NSIS 相关依赖，需保持网络畅通，耗时较长属正常。

### 修改版本号

打包前修改 `electron/package.json` 中的 `version` 字段（如 `"0.2.0"`），安装包文件名与自动更新均以此版本号为准。

### 一键打包（推荐）

在 Windows PowerShell 中执行：

```powershell
.\scripts\build-desktop.ps1
```

脚本自动完成全部 6 步：

1. 生成图标（`scripts/generate-icons.ps1` → `electron/assets/`）。
2. 前端构建：`cd frontend && pnpm install && pnpm build`。
3. 复制前端产物到 `backend/static/dist/`。
4. 准备 `electron/resources/` 目录。
5. PyInstaller 打包后端：`uv run --with pyinstaller pyinstaller ... desktop_entry.py`，产物为 `electron/resources/ghost-flow-backend.exe`（单文件，内含前端静态资源与 Alembic 迁移脚本）。
6. Electron 打包：`cd electron && pnpm install && pnpm dist`（先 `tsc` 编译主进程，再 electron-builder 打 NSIS 安装包）。

### 打包产物

`electron/dist-electron/` 目录下（`electron/package.json` 的 `build.win.target` 同时配置了 `nsis` 与 `portable`，一次打包两种产物都有）：

- `Ghost Flow Work App Setup <version>.exe` — NSIS 安装包（分发给最终用户的文件）。
- `Ghost Flow Work App <version>.exe` — **单文件免安装便携版**，详见下节。
- `win-unpacked/` — 免安装的绿色版目录（未压缩成单文件），可直接运行其中的 `Ghost Flow Work App.exe` 做打包后验证。
- `latest.yml` + `.blockmap` — 自动更新元数据，发布 GitHub Release 时随安装包一起上传。

### 单文件免安装版（portable）

适合直接发给用户、无需管理员权限安装的场景：整个应用（Electron + 内嵌后端 + 前端页面）打包成**一个 exe**，双击即用。

**如何打出便携版**

无需额外配置——`build.win.target` 已包含 `portable`，执行一键打包脚本即可同时产出 NSIS 安装包与便携版：

```powershell
.\scripts\build-desktop.ps1
```

或者在已有 `electron/resources/ghost-flow-backend.exe` 的前提下，只重打 Electron 部分：

```powershell
cd electron
pnpm dist    # 同时产出 NSIS 安装包与便携版 exe
```

产物为 `electron/dist-electron/Ghost Flow Work App <version>.exe`（无 `Setup` 字样、体积约 200MB+ 的那个文件）。

**便携版的使用与注意事项**

- **分发方式**：把这个 exe 单独拷给用户即可（U 盘、网盘、IM 传文件都行），无需安装、不写注册表、不创建快捷方式。
- **首次启动较慢**：运行时 exe 会先自解压到系统临时目录再启动，首次约 5~10 秒，属正常现象。
- **数据位置**：数据目录（SQLite 库、日志）在 **便携 exe 同级的 `data/` 目录**（`main.ts` 通过 `PORTABLE_EXECUTABLE_DIR` 定位 exe 真实所在目录，而不是临时解压目录），拷走 exe + `data/` 即可整体迁移。
- **exe 需放在可写目录**：不要放在 `C:\Program Files` 这类需要管理员权限的目录，否则 `data/` 无法创建。
- **不支持自动更新**：portable 目标没有 `latest.yml`，升级时直接替换 exe 文件即可，`data/` 目录不受影响。
- **与绿色版目录的区别**：`win-unpacked/` 是一个目录（启动更快，无需自解压）；便携版是单文件（分发更方便）。两者数据互通逻辑一致，都是"程序所在目录下的 `data/`"。

### 手动分步打包

```powershell
# 1. 前端构建并复制到后端 static
cd frontend
pnpm build
# 将 frontend/dist/* 复制到 backend/static/dist/

# 2. PyInstaller 打包后端到 electron/resources/
cd backend
uv sync
uv run --with pyinstaller pyinstaller `
    --name ghost-flow-backend --onefile `
    --add-data "static/dist;static/dist" `
    --add-data "alembic;alembic" --add-data "alembic.ini;." `
    --collect-submodules app --paths . `
    --hidden-import sqlalchemy.ext.automap `
    --hidden-import apscheduler.triggers.cron `
    --hidden-import pandas._libs.tslibs.base `
    --distpath ../electron/resources --clean `
    desktop_entry.py

# 3. Electron 打包
cd electron
pnpm install
pnpm build   # tsc 编译 main.ts / preload.ts / updater.ts → dist/
pnpm dist    # electron-builder，产物在 electron/dist-electron/
```

### 打包后验证

1. 先运行 `electron/dist-electron/win-unpacked/Ghost Flow Work App.exe`，确认主窗口能打开、后端服务（17892 端口）正常拉起、界面数据可读写。
2. 再执行 NSIS 安装包走一遍安装流程，确认桌面快捷方式、托盘图标、开机后的数据目录（安装目录 `data/`）均正常。

### 常见问题

- **electron-builder 下载卡住**：首次打包需下载 Electron/NSIS 依赖，网络慢时可重试；已下载的依赖会缓存，后续打包很快。
- **PyInstaller 产物被杀毒软件拦截**：单文件 exe 可能误报，将 `electron/resources/` 加入杀软白名单后重打。
- **win-unpacked 能跑但安装后打不开**：多为数据目录权限问题，检查安装目录是否可写（`GHOST_FLOW_DATA_DIR` 指向安装目录 `data/`）。
- **运行打包产物报 `Cannot find module 'xxx'`（如 fs-extra）**：pnpm 默认的 isolated（符号链接）布局会让 electron-builder 漏收间接依赖。本项目已在 `electron/pnpm-workspace.yaml` 配置 `nodeLinker: hoisted`（扁平布局）并将 electron-updater 冲突版本的两个依赖（`builder-util-runtime`、`semver`）提升为直接依赖；若改动过依赖，重装后务必确认 `electron/node_modules/` 下不再存在 `.pnpm` 目录再打包。

---

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET/POST/PUT/DELETE | `/api/connections` | 连接管理 CRUD |
| POST | `/api/connections/test` | 测试连接（不落库，body：`{type, config}`） |
| GET/POST/PUT/DELETE | `/api/tasks` | 任务管理 CRUD |
| POST | `/api/tasks/upload` | 上传 `.sql`/`.py` 文件并提取任务信息 |
| POST | `/api/tasks/{id}/toggle` | 启停任务调度 |
| POST | `/api/execute/sql` | 临时 SQL 执行 |
| POST | `/api/execute/python` | 临时 Python 执行 |
| POST | `/api/execute/tasks/{id}/run` | 运行保存的任务 |
| POST | `/api/execute/tasks/{id}/test` | 测试运行任务（不保存运行记录） |
| GET | `/api/execute/tasks/{id}/preview` | 预览数据 |
| POST | `/api/execute/tasks/{id}/export` | 导出 CSV 到服务器路径 |
| GET | `/api/execute/tasks/{id}/download` | 下载 SQL 结果 CSV |
| POST | `/api/execute/runs/{id}/cancel` | 取消运行中的任务 |
| GET | `/api/schedules` | 排程任务列表（只读） |
| GET | `/api/schedules/status` | 调度引擎状态 |
| GET | `/api/task-runs` | 运行历史 |

---

## 开发规范

- 所有代码注释、文档、沟通使用中文。
- Python 包管理使用 `uv add`（禁止 pip install）；前端使用 pnpm。
- 前后端通过 RESTful JSON API 通信。
- 数据库 schema 变更使用 Alembic 迁移。

---

## 许可证

MIT
