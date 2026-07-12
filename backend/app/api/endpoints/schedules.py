from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.task import Task
from ...services.scheduler import get_scheduler_status


class ScheduleResponse(BaseModel):
    id: int
    name: str
    type: str
    schedule_config: str
    enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class JobInfo(BaseModel):
    id: str
    name: str
    next_run_time: str | None = None


class SchedulerStatusResponse(BaseModel):
    running: bool
    jobs: list[JobInfo]


router = APIRouter(prefix="/api/schedules", tags=["调度管理"])


@router.get("", response_model=list[ScheduleResponse])
def list_schedules(db: Session = Depends(get_db)):
    return (
        db.query(Task)
        .filter(Task.schedule_config.isnot(None))
        .order_by(Task.created_at.desc())
        .all()
    )


@router.get("/status", response_model=SchedulerStatusResponse)
def scheduler_status():
    return get_scheduler_status()
