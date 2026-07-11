import json
from datetime import datetime, timezone

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.connection import Connection
from ..models.task import Task
from ..models.task_run import TaskRun
from .executor.sql_executor import execute_sql as _exec_sql
from .executor.python_executor import execute_python
from .data_preview import preview_data
from .csv_exporter import export_to_csv

from loguru import logger

_engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
_scheduler: BackgroundScheduler | None = None


def _get_db() -> Session:
    return Session(_engine)


def _run_task_job(task_id: int):
    """APScheduler 调用的任务执行函数"""
    db = _get_db()
    try:
        task = db.get(Task, task_id)
        if not task or not task.enabled:
            return

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

                df = _exec_sql(conn, task.content, timeout=300)
                result = preview_data(df)

                run_record.status = "success"
                run_record.result_preview = json.dumps(result, ensure_ascii=False, default=str)
                run_record.row_count = result["total_rows"]

                if task.output_path:
                    export_to_csv(df, task.output_path)

            else:
                result = execute_python(task.content, timeout=60)
                run_record.status = "success" if result["success"] else "failed"
                if not result["success"]:
                    run_record.error_message = result["stderr"]
                run_record.result_preview = json.dumps(result, ensure_ascii=False, default=str)

        except Exception as e:
            run_record.status = "failed"
            run_record.error_message = str(e)

        run_record.finished_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        logger.exception(f"scheduler task {task_id} error: {e}")
    finally:
        db.close()


def _register_task(task: Task):
    """注册单个任务到调度器"""
    if not task.enabled or not task.schedule_config:
        return
    try:
        cfg = json.loads(task.schedule_config)
        cron = cfg.get("cron", "")
        timezone_str = cfg.get("timezone", "Asia/Shanghai")
        if not cron:
            return
        trigger = CronTrigger.from_crontab(cron, timezone=timezone_str)
        _scheduler.add_job(
            _run_task_job,
            trigger=trigger,
            id=f"task_{task.id}",
            args=[task.id],
            replace_existing=True,
        )
        logger.info(f"registered task {task.id} with cron '{cron}'")
    except Exception as e:
        logger.error(f"register task {task.id} failed: {e}")


def init_scheduler():
    global _scheduler
    if _scheduler is not None:
        return

    jobstore = SQLAlchemyJobStore(engine=_engine)
    _scheduler = BackgroundScheduler(jobstores={"default": jobstore})
    _scheduler.start()
    logger.info("scheduler started")

    db = _get_db()
    try:
        tasks = db.query(Task).filter(Task.enabled == True).all()
        for task in tasks:
            _register_task(task)
        logger.info(f"loaded {len(tasks)} scheduled tasks")
    finally:
        db.close()


def shutdown_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("scheduler stopped")


def add_task_job(task: Task):
    if _scheduler:
        _register_task(task)


def remove_task_job(task_id: int):
    if _scheduler:
        job_id = f"task_{task_id}"
        if _scheduler.get_job(job_id):
            _scheduler.remove_job(job_id)
            logger.info(f"removed job for task {task_id}")


def get_scheduler_status() -> dict:
    if not _scheduler:
        return {"running": False, "jobs": []}
    jobs = _scheduler.get_jobs()
    return {
        "running": _scheduler.running,
        "jobs": [
            {
                "id": j.id,
                "name": j.name,
                "next_run_time": str(j.next_run_time) if j.next_run_time else None,
            }
            for j in jobs
        ],
    }
