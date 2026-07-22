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
