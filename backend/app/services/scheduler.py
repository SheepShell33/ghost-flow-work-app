import json
from datetime import datetime, timedelta, timezone

from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from ..core.database import engine, SessionLocal
from ..models.task import Task
from ..models.task_run import TaskRun
from .task_runner import check_prerequisite, run_task

from loguru import logger

_scheduler: BackgroundScheduler | None = None


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


def _register_task(task: Task):
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

    jobstore = SQLAlchemyJobStore(engine=engine)
    _scheduler = BackgroundScheduler(jobstores={"default": jobstore})
    _scheduler.start()
    logger.info("scheduler started")

    db = SessionLocal()
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
