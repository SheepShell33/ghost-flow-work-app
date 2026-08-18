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


def test_retry_scheduled_on_python_failure(db, monkeypatch):
    """Python 脚本 success=False（非取消）也会调度重试"""
    task = _make_task(db, type="python", content="print(1)", retry_limit=1)
    monkeypatch.setattr("app.services.task_runner.check_dependencies", lambda *a, **k: [])
    monkeypatch.setattr(
        "app.services.task_runner.execute_python",
        lambda *a, **k: {"success": False, "stdout": "", "stderr": "err", "exit_code": 1},
    )
    calls = []
    monkeypatch.setattr(
        "app.services.scheduler.schedule_retry",
        lambda *args, **kwargs: calls.append(args),
    )
    result = run_task(task, db)
    assert result["status"] == "failed"
    assert len(calls) == 1
    assert "自动重试" in result["error_message"]


def test_no_retry_on_manual_cancel(db, monkeypatch):
    """手动取消的 Python 任务不调度重试"""
    task = _make_task(db, type="python", content="print(1)", retry_limit=1)
    monkeypatch.setattr("app.services.task_runner.check_dependencies", lambda *a, **k: [])
    monkeypatch.setattr(
        "app.services.task_runner.execute_python",
        lambda *a, **k: {"success": False, "stdout": "", "stderr": "err", "exit_code": 1},
    )
    monkeypatch.setattr("app.services.task_runner.run_tracker.pop_cancelled", lambda run_id: True)
    calls = []
    monkeypatch.setattr(
        "app.services.scheduler.schedule_retry",
        lambda *args, **kwargs: calls.append(args),
    )
    result = run_task(task, db)
    assert result["status"] == "failed"
    assert calls == []
    assert result["error_message"] == "用户手动取消"


def test_no_retry_when_attempt_exceeds_limit(db, monkeypatch):
    """链式重试边界：attempt 超过 retry_limit 后不再调度"""
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()
    task = _make_task(db, connection_id=conn_row.id, retry_limit=1, retry_delay=30)
    monkeypatch.setattr("app.services.task_runner.execute_sql", _boom)
    calls = []
    monkeypatch.setattr(
        "app.services.scheduler.schedule_retry",
        lambda *args, **kwargs: calls.append(args),
    )
    result = run_task(task, db, attempt=2)  # 2 > retry_limit=1，达到上限
    assert result["status"] == "failed"
    assert calls == []


def test_schedule_retry_failure_still_persists_run_record(db, monkeypatch):
    """schedule_retry 抛异常不影响运行记录落库（finished_at 写入并 commit）"""
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()
    task = _make_task(db, connection_id=conn_row.id, retry_limit=1, retry_delay=30)
    monkeypatch.setattr("app.services.task_runner.execute_sql", _boom)

    def _jobstore_down(*args, **kwargs):
        raise RuntimeError("jobstore down")

    monkeypatch.setattr("app.services.scheduler.schedule_retry", _jobstore_down)
    result = run_task(task, db)  # 不应抛出异常
    assert result["status"] == "failed"
    run = db.get(TaskRun, result["run_id"])
    assert run.finished_at is not None


def test_dependent_task_triggered_on_success(db, monkeypatch):
    """任务成功后应触发已启用的后置任务"""
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()

    task1 = _make_task(db, connection_id=conn_row.id, name="test 1")
    task2 = _make_task(
        db,
        connection_id=conn_row.id,
        name="test 2",
        prerequisite_task_id=task1.id,
        enabled=True,
    )

    monkeypatch.setattr(
        "app.services.task_runner.execute_sql",
        lambda *a, **k: pd.DataFrame({"a": [1]}),
    )
    triggered = []
    monkeypatch.setattr(
        "app.services.scheduler.trigger_task_now",
        lambda task_id: triggered.append(task_id),
    )

    result = run_task(task1, db)
    assert result["status"] == "success"
    assert triggered == [task2.id]


def test_dependent_task_not_triggered_on_failure(db, monkeypatch):
    """任务失败后不应触发后置任务"""
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()

    task1 = _make_task(db, connection_id=conn_row.id, name="test 1")
    task2 = _make_task(
        db,
        connection_id=conn_row.id,
        name="test 2",
        prerequisite_task_id=task1.id,
        enabled=True,
    )

    monkeypatch.setattr("app.services.task_runner.execute_sql", _boom)
    monkeypatch.setattr("app.services.scheduler.schedule_retry", lambda *a, **k: None)
    triggered = []
    monkeypatch.setattr(
        "app.services.scheduler.trigger_task_now",
        lambda task_id: triggered.append(task_id),
    )

    result = run_task(task1, db)
    assert result["status"] == "failed"
    assert triggered == []


def test_disabled_dependent_task_not_triggered(db, monkeypatch):
    """禁用的后置任务不应被触发"""
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()

    task1 = _make_task(db, connection_id=conn_row.id, name="test 1")
    task2 = _make_task(
        db,
        connection_id=conn_row.id,
        name="test 2",
        prerequisite_task_id=task1.id,
        enabled=False,  # 禁用
    )

    monkeypatch.setattr(
        "app.services.task_runner.execute_sql",
        lambda *a, **k: pd.DataFrame({"a": [1]}),
    )
    triggered = []
    monkeypatch.setattr(
        "app.services.scheduler.trigger_task_now",
        lambda task_id: triggered.append(task_id),
    )

    result = run_task(task1, db)
    assert result["status"] == "success"
    assert triggered == []


def test_chain_triggering(db, monkeypatch):
    """多级前置任务链可以传导：test1 -> test2 -> test3"""
    from app.models.connection import Connection
    conn_row = Connection(name="c", type="sqlite", config='{"file_path": "x.db"}')
    db.add(conn_row)
    db.commit()

    task1 = _make_task(db, connection_id=conn_row.id, name="test 1")
    task2 = _make_task(
        db,
        connection_id=conn_row.id,
        name="test 2",
        prerequisite_task_id=task1.id,
        enabled=True,
    )
    task3 = _make_task(
        db,
        connection_id=conn_row.id,
        name="test 3",
        prerequisite_task_id=task2.id,
        enabled=True,
    )

    monkeypatch.setattr(
        "app.services.task_runner.execute_sql",
        lambda *a, **k: pd.DataFrame({"a": [1]}),
    )

    executed_order = []

    def fake_trigger_now(task_id: int):
        executed_order.append(task_id)
        # 模拟 scheduler 执行被触发的任务
        dep_task = db.get(Task, task_id)
        if dep_task:
            run_task(dep_task, db)

    monkeypatch.setattr(
        "app.services.scheduler.trigger_task_now", fake_trigger_now
    )

    result = run_task(task1, db)
    assert result["status"] == "success"
    assert executed_order == [task2.id, task3.id]

    # 验证三个任务都有成功运行记录
    for task_id in [task1.id, task2.id, task3.id]:
        runs = db.query(TaskRun).filter(TaskRun.task_id == task_id).all()
        assert any(r.status == "success" for r in runs)
