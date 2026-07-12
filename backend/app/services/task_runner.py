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


def run_task(task: Task, db: Session, max_rows: int = 20) -> dict:
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
        run_record = TaskRun(task_id=task.id, status="running")
        db.add(run_record)
        db.commit()
        db.refresh(run_record)

        try:
            if task.type == "sql":
                if not task.connection_id:
                    raise ValueError("SQL 任务未关联数据库连接")
                conn = db.get(Connection, task.connection_id)
                if not conn:
                    raise ValueError(f"连接不存在 (id={task.connection_id})")
                df = execute_sql(conn, task.content, timeout=300, run_id=run_record.id)
                result = preview_data(df, max_rows=max_rows)

                run_record.status = "success"
                run_record.result_preview = json.dumps(result, ensure_ascii=False, default=str)
                run_record.row_count = result["total_rows"]

                if task.output_path:
                    export_to_csv(df, task.output_path)

            else:
                ensure_dependencies(task.content)
                result = execute_python(task.content, timeout=60, run_id=run_record.id)
                run_record.status = "success" if result["success"] else "failed"
                if not result["success"]:
                    if run_tracker.pop_cancelled(run_record.id):
                        run_record.error_message = "用户手动取消"
                    else:
                        run_record.error_message = result["stderr"] or "Python 执行失败"
                run_record.result_preview = json.dumps(result, ensure_ascii=False, default=str)

        except Exception as e:
            run_record.status = "failed"
            run_record.error_message = (
                "用户手动取消" if run_tracker.pop_cancelled(run_record.id) else str(e)
            )
            logger.exception(f"task {task.id} execution error: {e}")

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
