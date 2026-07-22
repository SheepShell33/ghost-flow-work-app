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
