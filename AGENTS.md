# AGENTS.md

## Project structure

- `backend/` — Python FastAPI (`uv` managed), `frontend/` — React + Vite (`pnpm` managed)
- Each is independent; no monorepo tool. Start both for development.

## Commands

```bash
# backend
cd backend && uv run uvicorn app.main:app --reload --port 8000
uv run pytest -v                  # 单元测试（backend/tests/）

# frontend
cd frontend && pnpm dev          # dev server on :5173
pnpm build                        # tsc -b && vite build
```

## Python (uv)

- `pyproject.toml` has `[tool.uv] package = false` — this is an application, not a library.
- Add deps: `uv add <pkg>` (no pip install).
- No `uv sync` required after `uv add` (it syncs automatically).
- `data/app.db` is created automatically on first startup via `init_db()`.
- Logging via loguru; logs to stderr and `data/logs/app_*.log`.

## Frontend (Vite + React)

- `tsconfig.app.json` enables `verbatimModuleSyntax` — always use `import type` for type-only imports.
- API proxy in `vite.config.ts` forwards `/api/*` to `http://127.0.0.1:8000`.
- No test framework installed yet (`oxlint` for lint only).

## Architecture

- **App DB** (SQLite, `data/app.db`): stores connections, tasks, task_runs, APScheduler jobs.
- **Target DBs** (SQLite / Redshift): configured by user via `Connection` model; connector in `services/connector/`.
- **Scheduler** (`services/scheduler.py`): APScheduler `BackgroundScheduler` with `SQLAlchemyJobStore`, started in FastAPI `lifespan`.
- Task execution flow: `POST /api/execute/tasks/{id}/run` → creates `TaskRun` record → executes via `sql_executor` or `python_executor` → saves result_preview as JSON.
- File upload: `POST /api/tasks/upload` accepts `.sql`/`.py` files, returns extracted name/type/content.
- Test run: `POST /api/execute/tasks/{id}/test` runs and returns first 20 rows (SQL) or stdout/stderr/exit_code (Python) without saving a TaskRun.
- Prerequisite tasks: `tasks.prerequisite_task_id` column; executor checks prerequisite success before running scheduled/manual tasks.
- Auto deps: `services/deps_installer.py` parses Python `import`/`from` statements via `ast`, maps import names to pip package names (`IMPORT_TO_PACKAGE`: sklearn→scikit-learn, yaml→pyyaml, PIL→Pillow, cv2→opencv-python, bs4→beautifulsoup4), installs missing packages via pip. **安装失败抛 `RuntimeError`（含 pip stderr 摘要）**：`/api/execute/python` 转为 400，`/api/execute/tasks/{id}/test` 转为 400，`task_runner` 写入 `TaskRun.error_message`。
- Connection test: `POST /api/connections/test`（body `{type, config(JSON 字符串)}`）不落库，按 type 取 connector 执行 `SELECT 1`，返回 `{success, message}`；定义在 `/{connection_id}` 之前避免被路径参数捕获。
- Task retry: `tasks.retry_limit`/`retry_delay`/`timeout_seconds` columns; failed runs (non-ValueError, not cancelled) schedule one-shot APScheduler date jobs via `scheduler.schedule_retry()`; `task_runs.attempt`/`parent_run_id` track retry attempts.

## API entrypoints (backend/app/api/endpoints/)

| File | Prefix | Purpose |
|---|---|---|
| `connections.py` | `/api/connections` | CRUD for DB connections |
| `tasks.py` | `/api/tasks` | CRUD + `/toggle` for tasks |
| `execute.py` | `/api/execute` | Run tasks, ad-hoc SQL/Python, preview, export CSV |
| `schedules.py` | `/api/schedules` | List scheduled tasks + scheduler status |
| `task_runs.py` | `/api/task-runs` | Run history |

## Conventions

- All code comments, docs, and communication in **Chinese**.
- Database schema is managed by Alembic; new environments run `uv run alembic upgrade head`.
- Redshift auth (`services/connector/redshift_connector_impl.py`): `auth_type` ∈ `browser_azure`（Azure AD / Entra 浏览器 SSO，内置 `BrowserAzureCredentialsProvider`，必填 `host/database/cluster_identifier/client_id/idp_tenant`，`region` 缺省时由 connector 从 host 推导）、`iam_keys`、`password`；兼容映射 `iam`→`iam_keys`、无 `auth_type` 且含 `idp_tenant`→`browser_azure`、无 `auth_type` 且含 `user+password`→`password`；旧 `okta`（Java 插件）分支原样保留。各分支连接前校验必填，缺失抛中文 `ValueError`。
- Python executor runs in `subprocess` sandbox; SQL executor uses `ThreadPoolExecutor` for timeout.
- Frontend uses Ant Design 6 (`darkAlgorithm` via `ConfigProvider` in `main.tsx`), all pages are under `src/pages/`, layout in `src/components/AppLayout.tsx`.
- Frontend styling: `src/main.tsx` MUST keep `import './index.css'`（曾因缺失导致自定义样式从未加载）. Global styles use `.ghost-*` classes and `--ghost-*` CSS variables defined in `src/index.css`; component tokens are aligned in `main.tsx` `ConfigProvider`. Do NOT add `!important` overrides on antd preset-color components (e.g. `.ant-tag`) — use `ConfigProvider` component tokens instead.
- Electron 打包：`electron/pnpm-workspace.yaml` 必须保持 `nodeLinker: hoisted`（pnpm 默认 isolated 符号链接布局会让 electron-builder 漏收间接依赖，运行时报 `Cannot find module 'fs-extra'` 等）；与 electron-builder 自身版本冲突的运行时依赖（`builder-util-runtime`、`semver`）需在 `electron/package.json` 中声明为直接依赖，使 hoisted 根目录版本满足 electron-updater。改动 electron 依赖后应确认 `electron/node_modules/` 无 `.pnpm` 目录再打包。
- After any significant feature update, bugfix, or other change, run `git commit` locally (do not push automatically).
