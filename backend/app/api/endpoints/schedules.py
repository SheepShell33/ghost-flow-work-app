from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.task import Task
from ...services.scheduler import get_scheduler_status

router = APIRouter(prefix="/api/schedules", tags=["调度管理"])


@router.get("")
def list_schedules(db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.schedule_config.isnot(None)).order_by(Task.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "type": t.type,
            "schedule_config": t.schedule_config,
            "enabled": t.enabled,
            "created_at": t.created_at.isoformat(),
        }
        for t in tasks
    ]


@router.get("/status")
def scheduler_status():
    return get_scheduler_status()
