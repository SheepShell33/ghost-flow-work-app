from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.task import Task
from ...schemas.task import TaskCreate, TaskResponse, TaskUpdate
from ...services.scheduler import add_task_job, remove_task_job

router = APIRouter(prefix="/api/tasks", tags=["任务管理"])


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    q: str | None = None,
    tag: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Task)
    if q:
        like = f"%{q}%"
        query = query.filter(
            Task.name.ilike(like) | Task.content.ilike(like)
        )
    if tag:
        query = query.filter(Task.tags.ilike(f"%{tag}%"))
    return query.order_by(Task.created_at.desc()).all()


@router.post("/upload", response_model=TaskResponse, status_code=201)
async def upload_task_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    connection_id: int | None = Form(None),
    output_path: str | None = Form(None),
    schedule_config: str | None = Form(None),
    prerequisite_task_id: int | None = Form(None),
    enabled: bool = Form(False),
    db: Session = Depends(get_db),
):
    content = (await file.read()).decode("utf-8")
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else ""
    if ext == "sql":
        task_type = "sql"
    elif ext == "py":
        task_type = "python"
    else:
        raise HTTPException(status_code=400, detail="仅支持 .sql 和 .py 文件")
    if not content.strip():
        raise HTTPException(status_code=400, detail="文件内容为空")

    task = Task(
        name=name,
        type=task_type,
        content=content,
        connection_id=connection_id,
        output_path=output_path,
        schedule_config=schedule_config,
        prerequisite_task_id=prerequisite_task_id,
        enabled=enabled,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    if task.enabled and task.schedule_config:
        add_task_job(task)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    if task.enabled and task.schedule_config:
        add_task_job(task)
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)

    remove_task_job(task.id)
    if task.enabled and task.schedule_config:
        add_task_job(task)

    return task


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    remove_task_job(task.id)
    db.delete(task)
    db.commit()
    return {"message": "删除成功"}


@router.post("/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    task.enabled = not task.enabled
    db.commit()
    db.refresh(task)

    if task.enabled and task.schedule_config:
        add_task_job(task)
    else:
        remove_task_job(task.id)

    return {"id": task.id, "enabled": task.enabled}
