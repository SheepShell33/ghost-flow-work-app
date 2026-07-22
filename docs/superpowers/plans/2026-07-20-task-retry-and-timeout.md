# 任务失败自动重试 + 超时策略 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 任务执行失败时按配置自动重试（APScheduler 一次性 date job），并支持按任务配置执行超时时间。

**Architecture:** Task 表增加 `retry_limit`/`retry_delay`/`timeout_seconds`，TaskRun 表增加 `attempt`/`parent_run_id`。`run_task` 失败后通过 `scheduler.schedule_retry()` 调度一次性重试 job（惰性导入避免循环依赖）；重试 job 复用 `_run_task_job` 并携带 attempt/parent_run_id。前端任务表单增加重试与超时配置，历史页显示尝试次数。

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Alembic + APScheduler（SQLAlchemyJobStore）+ pytest；React 19 + Ant Design 6 + pnpm。

## Global Constraints

- 所有代码注释、文档、沟通用**中文**。
- 后端包管理用 `uv`（不要 pip install）；测试命令 `cd backend && uv run pytest -v`。
- 数据库 schema 变更必须走 Alembic 迁移（`uv run alembic revision --autogenerate` + `uv run alembic upgrade head`）。
- 前端 `tsconfig.app.json` 开启 `verbatimModuleSyntax`：类型导入必须 `import type`。
- 前端样式用 `.ghost-*` 类与 `--ghost-*` CSS 变量；不得对 antd 预设色组件加 `!important`。
- 非瞬态错误不重试：前置任务失败、`ValueError`（参数/连接配置错误）、手动取消。
- 测试运行（`/api/execute/tasks/{id}/test`）不重试、不写 TaskRun，但使用 `timeout_seconds`。
- 每个 Task 完成后按步骤中的命令 `git commit`（本地提交，不推送）。

---

### Task 1: 数据模型 + Schemas + Alembic 迁移

**Files:**
- Modify: `backend/app/models/task.py`
- Modify: `backend/app/models/task_run.py`
- Modify: `backend/app/schemas/task.py`
- Modify: `backend/app/schemas/task_run.py`
- Create: `backend/alembic/versions/<自动生成>_add_task_retry_and_timeout_fields.py`
- Test: `backend/tests/test_retry_models.py`

**Interfaces:**
- Produces（后续 Task 依赖）:
  - `Task.retry_limit: int`（默认 0）、`Task.retry_delay: int`（默认 60）、`Task.timeout_seconds: int | None`
  - `TaskRun.attempt: int`（默认 1）、`TaskRun.parent_run_id: int | None`
  - schemas 同名字段（TaskCreate/TaskUpdate/TaskResponse、TaskRunResponse）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_retry_models.py`：

```python
"""任务重试/超时字段的模型与 schema 测试"""
from app.models.task import Task
from app.models.task_run import TaskRun
from app.schemas.task import TaskCreate
from app.schemas.task_run import TaskRunResponse


def test_task_model_retry_defaults():
    task = Task(name="t", type="sql", content="SELECT 1")
    assert task.retry_limit in (0, None)  # 未 flush 时 Python 侧 default 可能未生效
    assert task.retry_delay in (60, None)
    assert task.timeout_seconds is None


def test_task_schema_retry_fields():
    data = TaskCreate(name="t", type="sql", content="SELECT 1",
                      retry_limit=3, retry_delay=120, timeout_seconds=45)
    assert data.retry_limit == 3
    assert data.retry_delay == 120
    assert data.timeout_seconds == 45


def test_task_schema_retry_defaults():
    data = TaskCreate(name="t", type="sql", content="SELECT 1")
    assert data.retry_limit == 0
    assert data.retry_delay == 60
    assert data.timeout_seconds is None


def test_task_run_model_attempt_fields():
    run = TaskRun(task_id=1, status="running")
    assert run.attempt in (1, None)
    assert run.parent_run_id is None
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/test_retry_models.py -v`
Expected: FAIL（`TypeError: ... unexpected keyword argument 'retry_limit'` 或 AttributeError）

- [ ] **Step 3: 修改模型**

`backend/app/models/task.py`，在 `enabled` 字段后追加：

```python
    retry_limit: Mapped[int] = mapped_column(Integer, default=0, server_default="0", comment="失败重试次数（不含首次执行）")
    retry_delay: Mapped[int] = mapped_column(Integer, default=60, server_default="60", comment="重试间隔秒数")
    timeout_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="执行超时秒数，None 使用类型默认值（SQL 300 / Python 60）")
```

`backend/app/models/task_run.py`，在 `finished_at` 字段后追加：

```python
    attempt: Mapped[int] = mapped_column(Integer, default=1, server_default="1", comment="第几次执行（含首次）")
    parent_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="指向首次运行的 TaskRun id，用于重试归组")
```

- [ ] **Step 4: 修改 schemas**

`backend/app/schemas/task.py`：`TaskBase` 在 `enabled` 后追加：

```python
    retry_limit: int = Field(0, ge=0, description="失败重试次数")
    retry_delay: int = Field(60, ge=0, description="重试间隔秒数")
    timeout_seconds: int | None = Field(None, ge=1, description="执行超时秒数，None 用默认值")
```

`TaskUpdate` 在 `enabled` 后追加：

```python
    retry_limit: int | None = Field(None, ge=0)
    retry_delay: int | None = Field(None, ge=0)
    timeout_seconds: int | None = Field(None, ge=1)
```

`backend/app/schemas/task_run.py`：`TaskRunResponse` 在 `row_count` 后追加：

```python
    attempt: int = 1
    parent_run_id: int | None = None
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/test_retry_models.py -v`
Expected: 4 passed

- [ ] **Step 6: 生成并应用 Alembic 迁移**

Run: `cd backend && uv run alembic revision --autogenerate -m "add task retry and timeout fields"`
检查生成的文件：`upgrade()` 应包含 5 个 `op.add_column`（tasks 表 3 个、task_runs 表 2 个），`downgrade()` 对应 5 个 `op.drop_column`。

Run: `cd backend && uv run alembic upgrade head`
Expected: 输出 `Running upgrade 7f002a1f2efa -> <new_id>, add task retry and timeout fields`

Run: `cd backend && uv run pytest -v`
Expected: 全部通过（含既有 23 例）

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/task.py backend/app/models/task_run.py backend/app/schemas/task.py backend/app/schemas/task_run.py backend/alembic/versions/ backend/tests/test_retry_models.py
git commit -m "feat(backend): Task/TaskRun 增加重试与超时字段 + Alembic 迁移"
```

---

### Task 2: Scheduler 支持一次性重试 job

**Files:**
- Modify: `backend/app/services/scheduler.py`
- Test: `backend/tests/test_scheduler_retry.py`

**Interfaces:**
- Consumes: Task 1 的 `TaskRun.attempt`、`TaskRun.parent_run_id`。
- Produces:
  - `schedule_retry(task_id: int, attempt: int, delay_seconds: int, parent_run_id: int | None = None) -> None`
  - `_run_task_job(task_id: int, attempt: int = 1, parent_run_id: int | None = None) -> None`（签名扩展，向后兼容）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_scheduler_retry.py`：

```python
"""schedule_retry 一次性重试 job 测试"""
from datetime import datetime, timezone

import app.services.scheduler as scheduler


class _FakeScheduler:
    """记录 add_job 调用的假调度器"""

    def __init__(self):
        self.jobs = []

    def add_job(self, func, trigger=None, run_date=None, id=None, args=None,
                replace_existing=False, misfire_grace_time=None, **kwargs):
        self.jobs.append({
            "func": func, "trigger": trigger, "run_date": run_date,
            "id": id, "args": args,
            "replace_existing": replace_existing,
            "misfire_grace_time": misfire_grace_time,
        })


def test_schedule_retry_creates_date_job(monkeypatch):
    fake = _FakeScheduler()
    monkeypatch.setattr(scheduler, "_scheduler", fake)
    scheduler.schedule_retry(task_id=7, attempt=2, delay_seconds=30, parent_run_id=99)
    assert len(fake.jobs) == 1
    job = fake.jobs[0]
    assert job["func"] is scheduler._run_task_job
    assert job["trigger"] == "date"
    assert job["id"] == "retry_task_7_2"
    assert job["args"] == [7, 2, 99]
    assert job["replace_existing"] is True
    # run_date 应在未来约 30 秒
    delta = (job["run_date"] - datetime.now(timezone.utc)).total_seconds()
    assert 25 < delta <= 30


def test_schedule_retry_without_scheduler(monkeypatch):
    monkeypatch.setattr(scheduler, "_scheduler", None)
    # 调度器未启动时不抛异常，静默丢弃
    scheduler.schedule_retry(task_id=7, attempt=2, delay_seconds=30)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/test_scheduler_retry.py -v`
Expected: FAIL（`AttributeError: module ... has no attribute 'schedule_retry'`）

- [ ] **Step 3: 实现 scheduler 修改**

`backend/app/services/scheduler.py`：

1) 顶部 import 区追加 `timedelta`：

```python
from datetime import datetime, timedelta, timezone
```

2) `_run_task_job` 扩展签名并透传 attempt/parent_run_id（完整替换现有函数）：

```python
def _run_task_job(task_id: int, attempt: int = 1, parent_run_id: int | None = None):
    db = SessionLocal()
    try:
        task = db.get(Task, task_id)
        if not task or not task.enabled:
            return

        err = check_prerequisite(task, db)
        if err:
            run_record = TaskRun(task_id=task.id, status="failed", error_message=err,
                                 attempt=attempt, parent_run_id=parent_run_id)
            run_record.finished_at = datetime.now(timezone.utc)
            db.add(run_record)
            db.commit()
            logger.warning(f"task {task.id} skipped: {err}")
            return

        result = run_task(task, db, attempt=attempt, parent_run_id=parent_run_id)
        logger.info(f"task {task.id} completed with status {result['status']}")
    except Exception as e:
        logger.exception(f"scheduler task {task_id} error: {e}")
    finally:
        db.close()
```

3) 文件末尾追加 `schedule_retry`：

```python
def schedule_retry(task_id: int, attempt: int, delay_seconds: int, parent_run_id: int | None = None):
    """调度一次性重试 job（date 触发器，持久化到 SQLAlchemyJobStore，重启后仍可触发）"""
    if not _scheduler:
        logger.warning(f"scheduler 未运行，任务 {task_id} 第 {attempt} 次重试被丢弃")
        return
    run_date = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
    _scheduler.add_job(
        _run_task_job,
        trigger="date",
        run_date=run_date,
        id=f"retry_task_{task_id}_{attempt}",
        args=[task_id, attempt, parent_run_id],
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info(f"scheduled retry for task {task_id}, attempt {attempt} at {run_date}")
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/test_scheduler_retry.py -v`
Expected: 2 passed

- [ ] **Step 5: 全量回归**

Run: `cd backend && uv run pytest -v`
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/scheduler.py backend/tests/test_scheduler_retry.py
git commit -m "feat(backend): scheduler 支持一次性重试 job（schedule_retry）"
```

---

### Task 3: task_runner 重试编排 + 超时下传

**Files:**
- Modify: `backend/app/services/task_runner.py`
- Test: `backend/tests/test_task_retry.py`

**Interfaces:**
- Consumes: Task 1 的模型字段；Task 2 的 `schedule_retry(task_id, attempt, delay_seconds, parent_run_id)`。
- Produces: `run_task(task: Task, db: Session, attempt: int = 1, parent_run_id: int | None = None, max_rows: int = 20) -> dict`（签名扩展，`execute.py` 现有调用 `run_task(task, db)` 无需修改）。
- 重试判定规则：仅当 `status == "failed"` 且未手动取消、且异常不是 `ValueError`（参数/连接配置错误）时重试；Python 脚本 `success=False`（非取消）也重试。

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_task_retry.py`：

```python
"""task_runner 失败重试与超时下传测试"""
import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.task import Task
from app.models.task_run import TaskRun
from app.services.task_runner import run_task


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _make_task(db, **overrides):
    defaults = dict(name="t", type="sql", content="SELECT 1", connection_id=None)
    defaults.update(overrides)
    task = Task(**defaults)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _boom(*args, **kwargs):
    raise RuntimeError("boom")


def test_retry_scheduled_on_transient_failure(db, monkeypatch):
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()
    task = _make_task(db, connection_id=conn_row.id, retry_limit=2, retry_delay=30)
    monkeypatch.setattr("app.services.task_runner.execute_sql", _boom)
    calls = []
    monkeypatch.setattr(
        "app.services.scheduler.schedule_retry",
        lambda *args, **kwargs: calls.append(args),
    )
    result = run_task(task, db)
    assert result["status"] == "failed"
    assert len(calls) == 1
    assert calls[0][:3] == (task.id, 2, 30)
    assert calls[0][3] == result["run_id"]  # parent_run_id 指向首次运行
    assert "自动重试" in result["error_message"]


def test_no_retry_when_limit_zero(db, monkeypatch):
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()
    task = _make_task(db, connection_id=conn_row.id)  # retry_limit 默认 0
    monkeypatch.setattr("app.services.task_runner.execute_sql", _boom)
    calls = []
    monkeypatch.setattr(
        "app.services.scheduler.schedule_retry",
        lambda *args, **kwargs: calls.append(args),
    )
    result = run_task(task, db)
    assert result["status"] == "failed"
    assert calls == []
    assert "自动重试" not in result["error_message"]


def test_no_retry_on_value_error(db, monkeypatch):
    """ValueError（连接配置/参数错误）属非瞬态错误，不重试"""
    task = _make_task(db, retry_limit=2)  # 无 connection_id → ValueError
    calls = []
    monkeypatch.setattr(
        "app.services.scheduler.schedule_retry",
        lambda *args, **kwargs: calls.append(args),
    )
    result = run_task(task, db)
    assert result["status"] == "failed"
    assert calls == []


def test_no_retry_on_prerequisite_failure(db, monkeypatch):
    task = _make_task(db, retry_limit=2, prerequisite_task_id=9999)
    calls = []
    monkeypatch.setattr(
        "app.services.scheduler.schedule_retry",
        lambda *args, **kwargs: calls.append(args),
    )
    result = run_task(task, db)
    assert result["status"] == "failed"
    assert calls == []


def test_timeout_default_and_custom(db, monkeypatch):
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()

    captured = {}

    def fake_execute_sql(conn, sql, timeout=300, run_id=None):
        captured["timeout"] = timeout
        return pd.DataFrame({"a": [1]})

    monkeypatch.setattr("app.services.task_runner.execute_sql", fake_execute_sql)

    task = _make_task(db, connection_id=conn_row.id)
    run_task(task, db)
    assert captured["timeout"] == 300

    task2 = _make_task(db, connection_id=conn_row.id, timeout_seconds=42)
    run_task(task2, db)
    assert captured["timeout"] == 42


def test_attempt_and_parent_recorded(db, monkeypatch):
    task = _make_task(db, retry_limit=1)
    monkeypatch.setattr("app.services.task_runner.execute_sql", _boom)
    monkeypatch.setattr("app.services.scheduler.schedule_retry", lambda *a, **k: None)
    run_task(task, db, attempt=2, parent_run_id=5)
    run = db.query(TaskRun).order_by(TaskRun.id.desc()).first()
    assert run.attempt == 2
    assert run.parent_run_id == 5
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && uv run pytest tests/test_task_retry.py -v`
Expected: FAIL（重试相关断言失败、`timeout` 仍为硬编码）

- [ ] **Step 3: 修改 task_runner.py**

`backend/app/services/task_runner.py` 做以下修改（其余代码保持不变）：

1) `run_task` 签名改为：

```python
def run_task(task: Task, db: Session, attempt: int = 1,
             parent_run_id: int | None = None, max_rows: int = 20) -> dict:
```

2) 创建运行记录处改为：

```python
        run_record = TaskRun(task_id=task.id, status="running",
                             attempt=attempt, parent_run_id=parent_run_id)
```

3) SQL 执行处超时下传：

```python
                df = execute_sql(conn, task.content, timeout=task.timeout_seconds or 300, run_id=run_record.id)
```

4) Python 执行处超时下传：

```python
                result = execute_python(task.content, timeout=task.timeout_seconds or 60, run_id=run_record.id)
```

5) 在内部 `try:`（执行 SQL/Python 的那个 try，位于 run_record 创建之后）之前初始化两个标记：

```python
        was_cancelled = False
        non_retryable = False
```

Python 失败分支改为记录取消标记：

```python
                if not result["success"]:
                    if run_tracker.pop_cancelled(run_record.id):
                        was_cancelled = True
                        run_record.error_message = "用户手动取消"
                    else:
                        run_record.error_message = result["stderr"] or "Python 执行失败"
```

except 分支改为：

```python
        except Exception as e:
            was_cancelled = run_tracker.pop_cancelled(run_record.id)
            # ValueError 为参数/连接配置错误，属非瞬态错误，不重试
            non_retryable = isinstance(e, ValueError)
            run_record.status = "failed"
            run_record.error_message = "用户手动取消" if was_cancelled else str(e)
            logger.exception(f"task {task.id} execution error: {e}")
```

6) 在 `run_record.finished_at = ...` 之前插入重试调度逻辑：

```python
        # 失败自动重试：非取消、非 ValueError（非瞬态）、未超上限时，调度一次性重试 job
        if (
            run_record.status == "failed"
            and not was_cancelled
            and not non_retryable
            and attempt <= task.retry_limit
        ):
            next_attempt = attempt + 1
            run_record.error_message = (
                f"{run_record.error_message}（将在 {task.retry_delay} 秒后自动重试，第 {next_attempt} 次尝试）"
            )
            # 惰性导入避免循环依赖（scheduler 顶部已导入本模块）
            from .scheduler import schedule_retry
            schedule_retry(task.id, next_attempt, task.retry_delay,
                           parent_run_id or run_record.id)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && uv run pytest tests/test_task_retry.py -v`
Expected: 6 passed

- [ ] **Step 5: 全量回归**

Run: `cd backend && uv run pytest -v`
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/task_runner.py backend/tests/test_task_retry.py
git commit -m "feat(backend): task_runner 失败自动重试编排 + 按任务超时下传"
```

---

### Task 4: 测试运行端点超时下传

**Files:**
- Modify: `backend/app/api/endpoints/execute.py`

**Interfaces:**
- Consumes: Task 1 的 `Task.timeout_seconds`。
- Produces: 无新接口；`/api/execute/tasks/{id}/test` 行为变化（超时按任务配置）。

- [ ] **Step 1: 修改 execute.py 的 test_task**

`backend/app/api/endpoints/execute.py` 的 `test_task` 函数中两处修改：

SQL 分支：

```python
            df = execute_sql(conn, task.content, timeout=task.timeout_seconds or 300)
```

Python 分支：

```python
            result = execute_python(task.content, timeout=task.timeout_seconds or 60)
```

- [ ] **Step 2: 全量回归**

Run: `cd backend && uv run pytest -v`
Expected: 全部通过

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/endpoints/execute.py
git commit -m "feat(backend): 测试运行端点使用任务配置的超时时间"
```

---

### Task 5: 前端表单 + API 类型 + 历史页

**Files:**
- Modify: `frontend/src/api/tasks.ts`
- Modify: `frontend/src/api/task-runs.ts`
- Modify: `frontend/src/pages/Tasks/TaskForm.tsx`
- Modify: `frontend/src/pages/History/index.tsx`

**Interfaces:**
- Consumes: 后端 Task/TaskRun 新字段（Task 1）。
- Produces: 无（终端 UI）。

- [ ] **Step 1: 更新 API 类型**

`frontend/src/api/tasks.ts`：`TaskItem` 在 `enabled` 后追加：

```typescript
  retry_limit: number
  retry_delay: number
  timeout_seconds: number | null
```

`TaskFormData` 在 `enabled` 后追加：

```typescript
  retry_limit?: number
  retry_delay?: number
  timeout_seconds?: number | null
```

`frontend/src/api/task-runs.ts`：`TaskRunItem` 在 `row_count` 后追加：

```typescript
  attempt: number
  parent_run_id: number | null
```

- [ ] **Step 2: TaskForm 增加重试与超时配置**

`frontend/src/pages/Tasks/TaskForm.tsx`：

1) antd import 行追加 `InputNumber`（在 `Input,` 后）。

2) `initialValues` 改为：

```tsx
        initialValues={{ type: 'sql', enabled: false, cron_tz: 'Asia/Shanghai', retry_limit: 0, retry_delay: 60 }}
```

3) 在"定时调度配置" Collapse 之后追加第二个 Collapse：

```tsx
        <Collapse ghost items={[{
          key: 'retry',
          label: '失败重试与超时',
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="retry_limit" label="失败重试次数" tooltip="0 表示不重试；重试对前置任务失败、配置错误和手动取消不生效">
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="retry_delay" label="重试间隔（秒）">
                <InputNumber min={0} max={86400} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="timeout_seconds" label="执行超时（秒）" tooltip="留空使用默认值：SQL 300 秒，Python 60 秒">
                <InputNumber min={1} max={86400} style={{ width: '100%' }} placeholder="默认" />
              </Form.Item>
            </Space>
          ),
        }]} />
```

编辑场景无需额外处理：`initial` 展开时已包含新字段（`values = { ...initial }`），且后端 TaskResponse 会返回它们。

- [ ] **Step 3: History 页显示尝试次数**

`frontend/src/pages/History/index.tsx`：

1) `columns` 中"状态"列后插入：

```tsx
    { title: '尝试', dataIndex: 'attempt', key: 'attempt', width: 70, align: 'center' as const,
      render: (v: number) => <span className="ghost-mono" style={{ fontSize: 13 }}>{v > 1 ? `第 ${v} 次` : '1'}</span> },
```

2) 展开详情 `Descriptions` 中"状态"项后插入：

```tsx
                  <Descriptions.Item label="尝试次数">{record.attempt ?? 1}</Descriptions.Item>
```

- [ ] **Step 4: 验证构建与 lint**

Run: `cd frontend && pnpm build`
Expected: `✓ built`，无 TS 错误

Run: `cd frontend && pnpm lint`
Expected: `Found 0 warnings and 0 errors.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/tasks.ts frontend/src/api/task-runs.ts frontend/src/pages/Tasks/TaskForm.tsx frontend/src/pages/History/index.tsx
git commit -m "feat(frontend): 任务表单支持重试/超时配置，历史页显示尝试次数"
```

---

### Task 6: 文档更新 + 全量验证

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1-5 的全部产物。
- Produces: 无。

- [ ] **Step 1: 更新 AGENTS.md**

在 `## Architecture` 一节追加一行：

```markdown
- Task retry: `tasks.retry_limit`/`retry_delay`/`timeout_seconds` columns; failed runs (non-ValueError, not cancelled) schedule one-shot APScheduler date jobs via `scheduler.schedule_retry()`; `task_runs.attempt`/`parent_run_id` track retry attempts.
```

- [ ] **Step 2: 更新 README.md**

在"使用手册 → 2. 创建任务"小节末尾追加：

```markdown
**失败重试与超时（可选）**：表单「失败重试与超时」折叠面板中可配置：
- **失败重试次数**：默认 0（不重试）。执行异常导致的失败会按间隔自动重试；前置任务失败、连接/参数配置错误、手动取消不会重试。
- **重试间隔（秒）**：默认 60。
- **执行超时（秒）**：留空使用默认值（SQL 300 秒，Python 60 秒）。

每次尝试都会在「运行历史」中生成一条记录，"尝试"列显示第几次执行。
```

- [ ] **Step 3: 全量验证**

Run: `cd backend && uv run pytest -v`
Expected: 全部通过（35 例）

Run: `cd frontend && pnpm build && pnpm lint`
Expected: 构建成功，0 errors

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: 记录任务失败重试与超时配置"
```
