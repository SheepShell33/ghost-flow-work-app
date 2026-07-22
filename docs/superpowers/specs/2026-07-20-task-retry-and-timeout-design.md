# 任务失败自动重试 + 超时策略 — 设计文档

日期：2026-07-20

## 背景

任务执行目前"一次失败即终结"：`backend/app/services/task_runner.py` 捕获异常后直接写 `TaskRun(status="failed")`，网络抖动、Redshift 临时超时等瞬态故障会导致任务整体失败，需要人工介入。SQL 执行超时固定 300 秒、Python 固定 60 秒，不可按任务调整。

## 已确认的决策

- 方向：可靠性/运维 → 失败自动重试 + 超时策略（方案 B）。
- 通知系统（方案 A）本期不做，后续另行设计。
- 重试间隔固定（不做指数退避）；所有执行异常都重试，非瞬态错误（前置任务失败、连接不存在等）除外。
- 测试运行（test）不重试、不记 TaskRun，但使用任务配置的超时时间。

## 1. 数据模型

`backend/app/models/task.py` 新增字段（需 Alembic 迁移）：

- `retry_limit: int = 0` — 失败重试次数（不含首次执行）。
- `retry_delay: int = 60` — 相邻两次执行的间隔秒数。
- `timeout_seconds: int | None = None` — 执行超时秒数；`None` 表示使用类型默认值（SQL 300，Python 60）。

`backend/app/models/task_run.py` 新增字段：

- `attempt: int = 1` — 本次是第几次执行。
- `parent_run_id: int | None = None` — 指向同一任务的首次运行，供历史页归组。

schemas：`backend/app/schemas/task.py`、`task_run.py` 同步增加上述字段。

Alembic：新增一个 revision，`alembic upgrade head` 时为已存在数据填默认值（retry_limit=0、retry_delay=60、attempt=1）。

## 2. 执行引擎（task_runner.py）

- `run_task` 签名调整为 `run_task(task_id: int, db: Session, attempt: int = 1, max_rows: int = 20)`（原来直接接收 `Task` 对象；改为传 `task_id` 是因为重试 job 无法携带 SQLAlchemy Session/Task 对象，job 内统一自建 Session 重新加载）。调用点 `execute.py`（`/tasks/{id}/run`）与 `scheduler.py` 同步修改。
- 非瞬态错误（前置任务未通过、连接不存在、任务被手动取消、参数校验失败）不重试，直接按现状写失败记录。
- 执行异常且 `attempt <= task.retry_limit` 时：
  1. 当前 TaskRun 记为 failed，error_message 末尾附"（将在 N 秒后进行第 M 次重试）"；历史页可见每次尝试。
  2. 释放任务级内存锁。
  3. 通过 APScheduler `add_job(..., trigger="date", run_date=now+retry_delay)` 调度一次性重试 job，参数为 `task_id` 与 `attempt+1`。
- 超过 `retry_limit` 后的失败为终态，error_message 不含重试说明。
- 超时：SQL 执行 `execute_sql(..., timeout=task.timeout_seconds or 300)`；Python `execute_python(..., timeout=task.timeout_seconds or 60)`。

## 3. 调度器集成（scheduler.py）

- 重试 job 使用独立 job id（如 `retry_task_{task_id}_{attempt}`），`replace_existing=True`，`misfire_grace_time` 适当放宽。
- 应用重启后丢失的内存态重试 job 不做持久化恢复（一次性 date job 存 SQLAlchemyJobStore 即可天然持久化，重启后仍可触发）。

## 4. API 与前端

- `POST /api/execute/tasks/{id}/run`：尊重任务重试配置（attempt=1 起步）。
- `POST /api/execute/tasks/{id}/test`：不重试、不写 TaskRun，但使用 `timeout_seconds`。
- `frontend/src/pages/Tasks/TaskForm.tsx`：新增高级配置区——"失败重试次数"（InputNumber, min 0）、"重试间隔（秒）"（InputNumber, min 0）、"执行超时（秒）"（InputNumber, min 1，留空即默认）。
- `frontend/src/pages/History/index.tsx`：列表增加"尝试次数"（attempt）列；同一 `parent_run_id` 的归组展示本期不做，仅显示数字。

## 5. 测试

- 后端 pytest（沿用 `backend/tests/`）：
  - 重试调度：mock `execute_sql` 首次抛异常，断言一次性 job 被创建且参数为 attempt+1；达到 retry_limit 后不再创建。
  - 非瞬态错误（前置任务失败）不创建重试 job。
  - 超时下传：`timeout_seconds=None` 时 SQL 传 300、Python 传 60；显式值透传。
  - schemas/Task 默认值（retry_limit=0 即不重试，行为与现状一致）。
- 前端：`pnpm build` + `pnpm lint`（oxlint）通过。

## 不做的事（YAGNI）

- 不做指数退避/抖动。
- 不按异常类型区分是否重试。
- 不做失败通知（方案 A，后续）。
- 不做历史页重试归组 UI（仅显示 attempt 数字）。
- 不重试"测试运行"。
