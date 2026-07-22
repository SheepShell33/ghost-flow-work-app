# Ghost Flow Work App

一个基于 Web 的任务计划调度工具，支持定时运行 Python 脚本和 SQL 查询，可连接 SQLite 和 AWS Redshift（支持 Azure AD 浏览器 SSO、IAM 密钥、用户名密码三种认证方式），同时提供 Electron 桌面应用打包。

## 功能列表

- **连接管理**：保存 SQLite / Redshift 数据库连接配置，结构化表单按认证方式动态展示字段，支持"测试连接"（`POST /api/connections/test`）。
- **任务管理**：创建 SQL / Python 任务，支持标签筛选、前置任务依赖（`prerequisite_task_id`）、上传 `.sql` / `.py` 文件自动建任务。
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

## 开发环境启动

环境要求：Python 3.12+、Node.js 20+、uv、pnpm。

```bash
# 后端
cd backend
uv sync
uv run alembic upgrade head                      # 新环境首次执行，初始化数据库
uv run uvicorn app.main:app --reload --port 8000

# 前端（新开终端）
cd frontend
pnpm install
pnpm dev
```

前端访问 http://localhost:5173 ，API 通过 Vite proxy 自动转发到后端 8000 端口。

运行测试：

```bash
cd backend
uv run pytest -v
```

数据库迁移常用命令：

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

### 5. 查看历史与导出 CSV

- **「运行历史」** 页面展示所有执行记录：状态、行数、开始/结束时间、错误信息。
- SQL 任务结果可「导出」到服务器指定路径，或「下载」为本地 CSV 文件。

---

## Electron 桌面打包

桌面版架构：Electron 主进程（`electron/main.ts`）启动内嵌的 `ghost-flow-backend.exe`（监听 `127.0.0.1:17892`），窗口加载后端托管的前端静态页面；支持系统托盘常驻与 GitHub Releases 自动更新。数据目录为安装目录下的 `data/`（环境变量 `GHOST_FLOW_DATA_DIR`）。

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

最终安装包位于 `electron/dist-electron/Ghost Flow Work App Setup <version>.exe`。

### 手动分步打包

```bash
# 1. 前端构建并复制到后端 static
cd frontend && pnpm build
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
