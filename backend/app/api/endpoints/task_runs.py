from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.task_run import TaskRun
from ...schemas.task_run import TaskRunResponse

router = APIRouter(prefix="/api/task-runs", tags=["运行历史"])


@router.get("", response_model=list[TaskRunResponse])
def list_task_runs(task_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(TaskRun).order_by(TaskRun.started_at.desc())
    if task_id:
        query = query.filter(TaskRun.task_id == task_id)
    return query.all()


@router.get("/{run_id}", response_model=TaskRunResponse)
def get_task_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(TaskRun, run_id)
    if not run:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="运行记录不存在")
    return run
