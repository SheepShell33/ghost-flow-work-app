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
