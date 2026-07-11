import json
from concurrent.futures import TimeoutError
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.connection import Connection
from ...models.task import Task
from ...models.task_run import TaskRun
from ...services.data_preview import preview_data
from ...services.csv_exporter import export_to_csv
from ...services.executor.sql_executor import execute_sql
from ...services.executor.python_executor import execute_python

router = APIRouter(prefix="/api/execute", tags=["执行引擎"])


class SQLExecuteRequest(BaseModel):
    connection_id: int
    sql: str
    max_rows: int = 100
    timeout: int = Field(default=300, description="超时时间(秒)")


class PythonExecuteRequest(BaseModel):
    code: str
    timeout: int = Field(default=60, description="超时时间(秒)")


@router.post("/sql")
def execute_adhoc_sql(req: SQLExecuteRequest, db: Session = Depends(get_db)):
    conn = db.get(Connection, req.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="连接不存在")
    try:
        df = execute_sql(conn, req.sql, timeout=req.timeout)
        return preview_data(df, max_rows=req.max_rows)
    except TimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/python")
def execute_adhoc_python(req: PythonExecuteRequest):
    return execute_python(req.code, timeout=req.timeout)


@router.post("/tasks/{task_id}/run")
def run_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

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
            df = execute_sql(conn, task.content)
            result = preview_data(df)

            run_record.status = "success"
            run_record.result_preview = json.dumps(result, ensure_ascii=False, default=str)
            run_record.row_count = result["total_rows"]

            if task.output_path:
                export_to_csv(df, task.output_path)

        else:
            result = execute_python(task.content)
            run_record.status = "success" if result["success"] else "failed"
            if not result["success"]:
                run_record.error_message = result["stderr"]
            run_record.result_preview = json.dumps(result, ensure_ascii=False, default=str)

    except Exception as e:
        run_record.status = "failed"
        run_record.error_message = str(e)

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


@router.get("/tasks/{task_id}/preview")
def preview_task_data(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.type != "sql":
        raise HTTPException(status_code=400, detail="只有 SQL 任务可以预览数据")
    if not task.connection_id:
        raise HTTPException(status_code=400, detail="任务未关联数据库连接")

    conn = db.get(Connection, task.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="关联连接不存在")
    try:
        df = execute_sql(conn, task.content)
        return preview_data(df)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tasks/{task_id}/export")
def export_task_csv(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.type != "sql":
        raise HTTPException(status_code=400, detail="只有 SQL 任务可以导出 CSV")
    if not task.output_path:
        raise HTTPException(status_code=400, detail="任务未设置 CSV 导出路径")
    if not task.connection_id:
        raise HTTPException(status_code=400, detail="任务未关联数据库连接")

    conn = db.get(Connection, task.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="关联连接不存在")
    try:
        df = execute_sql(conn, task.content)
        path = export_to_csv(df, task.output_path)
        return {"message": "导出成功", "file_path": path, "row_count": len(df)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
