# AGENTS.md

## Project structure

- `backend/` — Python FastAPI (`uv` managed), `frontend/` — React + Vite (`pnpm` managed)
- Each is independent; no monorepo tool. Start both for development.

## Commands

```bash
# backend
cd backend && uv run uvicorn app.main:app --reload --port 8000

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
- Auto deps: `services/deps_installer.py` parses Python `import`/`from` statements via `ast`, installs missing packages via pip.

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
- No Alembic migrations yet — schema is auto-created by SQLAlchemy `Base.metadata.create_all()`.
- Redshift Okta SSO uses `redshift-connector` with `OktaCredentialsProvider` (config: `idp_tenant`, `client_id`, `plugin_name`).
- Python executor runs in `subprocess` sandbox; SQL executor uses `ThreadPoolExecutor` for timeout.
- Frontend uses Ant Design 6, all pages are under `src/pages/`, layout in `src/components/AppLayout.tsx`.
