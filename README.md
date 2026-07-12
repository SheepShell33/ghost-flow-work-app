# Ghost Flow Work App

一个基于 Web 的任务计划调度工具，支持定时运行 Python 脚本和 SQL 查询，可连接 SQLite 和 AWS Redshift（含 IAM 与 Okta SSO 认证）。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Ant Design 6 |
| 后端 | FastAPI + Python 3.12 |
| 包管理 | uv (Python) / npm (前端) |
| ORM | SQLAlchemy 2.0 |
| 调度引擎 | APScheduler + SQLAlchemyJobStore |
| SQL 执行 | redshift-connector / SQLAlchemy |
| 应用数据库 | SQLite（零配置） |
| 数据库迁移 | Alembic |

---

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 20+
- uv（Python 包管理器）

### 1. 克隆并安装依赖

```bash
# 后端
cd backend
uv sync

# 新环境：初始化数据库迁移
uv run alembic upgrade head

# 启动后端服务
uv run uvicorn app.main:app --reload --port 8000

# 前端（新开终端）
cd frontend
npm install
npm run dev
```

前端访问 http://localhost:5173，API 通过 Vite proxy 自动转发到后端 8000 端口。

### 2. 打包构建

```bash
cd frontend
npm run build    # 输出到 frontend/dist/
```

---

## 使用指南

### 1. 管理数据库连接

在左侧导航栏点击 **「连接管理」**，可以新增/编辑/删除数据库连接。

**SQLite 连接配置：**

```json
{
  "file_path": "/path/to/your/database.db"
}
```

**Redshift IAM 认证：**

```json
{
  "host": "xxx.redshift.amazonaws.com",
  "port": 5439,
  "database": "dev",
  "user": "awsuser",
  "auth_type": "iam",
  "region": "us-east-1",
  "cluster_identifier": "my-cluster",
  "aws_access_key_id": "AKIA...",
  "aws_secret_access_key": "...",
  "aws_session_token": "..."
}
```

`aws_session_token` 仅在临时凭证场景下需要。

**Redshift Okta SSO 认证：**

```json
{
  "host": "xxx.redshift.amazonaws.com",
  "port": 5439,
  "database": "dev",
  "user": "user@company.com",
  "password": "...",
  "auth_type": "okta",
  "idp_tenant": "https://your-org.okta.com",
  "client_id": "0oa...",
  "plugin_name": "com.okta.redshift.okta_credentials_provider"
}
```

> 提示：选择连接类型后，点击「IAM 模板」或「Okta SSO 模板」按钮可自动填充配置框架。

### 2. 创建任务

在 **「任务管理」** 页面点击「新建任务」：

- **SQL 任务**：粘贴 SQL 代码，选择已保存的数据库连接，可设置 CSV 导出路径。
- **Python 任务**：粘贴 Python 代码，系统将在隔离沙箱中执行，并自动安装缺失的 pip 依赖。

任务还支持：
- **标签**：用于前端筛选。
- **前置任务**：指定 `prerequisite_task_id`，只有前置任务最后一次运行成功时才允许执行。
- **文件上传**：通过 `POST /api/tasks/upload` 上传 `.sql` 或 `.py` 文件自动创建任务。

### 3. 执行与预览

在任务列表的操作列中：

| 按钮 | 功能 |
|---|---|
| **执行** | 立即运行任务，弹窗显示结果 |
| **测试** | 运行任务但不保存运行记录 |
| **预览** | SQL 任务预览前 100 行数据 |
| **导出** | 将 SQL 结果导出到任务设置的 CSV 路径 |
| **下载** | 直接下载 SQL 结果为 CSV 文件 |
| **编辑** | 修改任务配置 |
| **删除** | 删除任务 |

运行中的任务可以在 **「运行历史」** 页面点击取消，后端会真正终止 Python 子进程 / SQL 执行线程。

### 4. 配置定时调度

在任务编辑表单中展开 **「定时调度配置」**：

1. 输入 **Cron 表达式**（例如 `0 9 * * *` 表示每天早上 9 点）。
2. 选择 **时区**（默认为 `Asia/Shanghai`）。
3. 打开 **「启用调度」** 开关。

开启调度后，APScheduler 会自动按 Cron 规则执行任务。可以在 **「调度配置」** 页面查看所有排程任务的状态和下次执行时间。

> 说明：当前调度配置内嵌在任务模型中，启停通过 `/api/tasks/{id}/toggle` 控制；`/api/schedules` 仅提供只读列表与状态。

### 5. 查看运行历史

**「运行历史」** 页面展示所有任务的执行记录，包括状态、行数、开始/结束时间、错误信息。

### 6. 仪表盘

首页仪表盘展示：数据库连接数、任务总数、成功/失败执行次数、调度引擎运行状态。

---

## 项目结构

```
ghost-flow-work-app/
├── backend/
│   ├── alembic/                    # 数据库迁移脚本
│   ├── alembic.ini                 # Alembic 配置
│   ├── app/
│   │   ├── main.py                 # FastAPI 入口
│   │   ├── core/                   # 配置、数据库、日志
│   │   ├── models/                 # ORM 模型
│   │   ├── schemas/                # 数据校验
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
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   │   ├── api/                    # 前端 API 调用
│   │   ├── components/             # 公共组件
│   │   └── pages/                  # 页面组件
│   ├── package.json
│   └── vite.config.ts
├── data/                           # 运行时数据（SQLite、日志）
├── plan.md                         # 项目计划文档
└── README.md
```

---

## 数据库迁移

项目使用 Alembic 管理数据库 schema。

```bash
cd backend

# 新环境创建所有表
uv run alembic upgrade head

# 查看当前版本
uv run alembic current

# 已有数据库且从未使用 Alembic，可手动标记为最新版本
uv run alembic stamp head
```

开发模式下，`app.core.database.init_db()` 也会自动建表；若表已存在但缺少 `alembic_version`，服务启动时会自动 `stamp head`。

---

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET/POST/PUT/DELETE | `/api/connections` | 连接管理 CRUD |
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
- Python 包管理使用 `uv add`。
- 前后端通过 RESTful JSON API 通信。
- 数据库迁移使用 Alembic。

---

## 许可证

MIT
