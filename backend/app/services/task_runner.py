import json
import threading
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models.connection import Connection
from ..models.task import Task
from ..models.task_run import TaskRun
from .executor.sql_executor import execute_sql
from .executor.python_executor import execute_python
from .data_preview import preview_data
from .csv_exporter import export_to_csv
from .deps_installer import ensure_dependencies
from . import run_tracker
from loguru import logger

# 内存中的任务级并发锁，防止同一任务被手动触发与调度触发同时执行
_task_lock = threading.Lock()
_active_task_ids: set[int] = set()


def check_prerequisite(task: Task, db: Session) -> str | None:
    if not task.prerequisite_task_id:
        return None
    prev = db.get(Task, task.prerequisite_task_id)
    if not prev:
        return f"前置任务 (id={task.prerequisite_task_id}) 不存在"
    last_run = (
        db.query(TaskRun)
        .filter(TaskRun.task_id == task.prerequisite_task_id)
        .order_by(TaskRun.started_at.desc())
        .first()
    )
    if not last_run:
        return f"前置任务「{prev.name}」从未运行"
    if last_run.status != "success":
        return f"前置任务「{prev.name}」最后运行状态为 {last_run.status}，不允许执行"
    return None


def _trigger_dependent_tasks(task: Task, db: Session) -> None:
    """当前任务成功后，触发所有以它为前置任务且已启用的后置任务。"""
    dependents = (
        db.query(Task)
        .filter(Task.prerequisite_task_id == task.id, Task.enabled == True)
        .all()
    )
    if not dependents:
        return
    # 惰性导入避免循环依赖
    from .scheduler import trigger_task_now
    for dep in dependents:
        logger.info(f"task {task.id} succeeded, triggering dependent task {dep.id}")
        try:
            trigger_task_now(dep.id)
        except Exception:
            logger.exception(f"task {task.id} trigger dependent task {dep.id} failed")


def run_task(task: Task, db: Session, attempt: int = 1,
             parent_run_id: int | None = None, max_rows: int = 20) -> dict:
    err = check_prerequisite(task, db)
    if err:
        run_record = TaskRun(task_id=task.id, status="failed", error_message=err)
        run_record.finished_at = datetime.now(timezone.utc)
        db.add(run_record)
        db.commit()
        db.refresh(run_record)
        return {"run_id": run_record.id, "status": "failed", "error_message": err, "result_preview": None, "row_count": None}

    # 任务级并发控制：数据库层 + 内存层双重校验
    existing_run = (
        db.query(TaskRun)
        .filter(TaskRun.task_id == task.id, TaskRun.status == "running")
        .first()
    )
    if existing_run:
        return {
            "run_id": existing_run.id,
            "status": "skipped",
            "error_message": "该任务正在运行中，请勿重复触发",
            "result_preview": None,
            "row_count": None,
        }

    with _task_lock:
        if task.id in _active_task_ids:
            return {
                "run_id": None,
                "status": "skipped",
                "error_message": "该任务正在运行中（内存锁）",
                "result_preview": None,
                "row_count": None,
            }
        _active_task_ids.add(task.id)

    try:
        run_record = TaskRun(task_id=task.id, status="running",
                             attempt=attempt, parent_run_id=parent_run_id)
        db.add(run_record)
        db.commit()
        db.refresh(run_record)

        was_cancelled = False
        non_retryable = False
        try:
            if task.type == "sql":
                if not task.connection_id:
                    raise ValueError("SQL 任务未关联数据库连接")
                conn = db.get(Connection, task.connection_id)
                if not conn:
                    raise ValueError(f"连接不存在 (id={task.connection_id})")
                df = execute_sql(conn, task.content, timeout=task.timeout_seconds or 300, run_id=run_record.id)
                result = preview_data(df, max_rows=max_rows)

                run_record.status = "success"
                run_record.result_preview = json.dumps(result, ensure_ascii=False, default=str)
                run_record.row_count = result["total_rows"]

                if task.output_path:
                    export_to_csv(df, task.output_path)

            else:
                ensure_dependencies(task.content)
                result = execute_python(task.content, timeout=task.timeout_seconds or 60, run_id=run_record.id)
                run_record.status = "success" if result["success"] else "failed"
                if not result["success"]:
                    if run_tracker.pop_cancelled(run_record.id):
                        was_cancelled = True
                        run_record.error_message = "用户手动取消"
                    else:
                        run_record.error_message = result["stderr"] or "Python 执行失败"
                run_record.result_preview = json.dumps(result, ensure_ascii=False, default=str)

        except Exception as e:
            was_cancelled = run_tracker.pop_cancelled(run_record.id)
            # ValueError 为参数/连接配置错误，属非瞬态错误，不重试
            non_retryable = isinstance(e, ValueError)
            run_record.status = "failed"
            run_record.error_message = "用户手动取消" if was_cancelled else str(e)
            logger.exception(f"task {task.id} execution error: {e}")

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
            try:
                schedule_retry(task.id, next_attempt, task.retry_delay,
                               parent_run_id or run_record.id)
            except Exception:
                # 调度失败（如 jobstore 故障）不应阻断运行记录落库，
                # 仅记录异常；重试说明保留，因为 job 可能已部分注册
                logger.exception(f"task {task.id} schedule retry failed")

        # 成功后触发后置任务：查找所有以当前任务为前置任务且已启用的任务
        if run_record.status == "success":
            _trigger_dependent_tasks(task, db)

        run_record.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run_record)

        return {
            "run_id": run_record.id,
            "status": run_record.status,
            "error_message": run_record.error_message,
            "result_preview": json.loads(run_record.result_preview) if run_record.result_preview else None,
            "row_count": run_record.row_count,
        }
    finally:
        with _task_lock:
            _active_task_ids.discard(task.id)
