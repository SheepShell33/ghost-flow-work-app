from concurrent.futures import TimeoutError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.connection import Connection
from ...models.task import Task
from ...models.task_run import TaskRun
from ...services.data_preview import preview_data
from ...services.executor.sql_executor import execute_sql
from ...services.executor.python_executor import execute_python
from ...services.deps_installer import ensure_dependencies
from ...services.python_env import get_effective_python
from ...services.task_runner import run_task, check_prerequisite
from ...services import run_tracker

router = APIRouter(prefix="/api/execute", tags=["执行引擎"])


class SQLExecuteRequest(BaseModel):
    connection_id: int
    sql: str
    max_rows: int = 20
    timeout: int = Field(default=300)


class PythonExecuteRequest(BaseModel):
    code: str
    timeout: int = Field(default=60)


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
def execute_adhoc_python(req: PythonExecuteRequest, db: Session = Depends(get_db)):
    try:
        python_path = get_effective_python(db)
        ensure_dependencies(req.code, db)
    except Exception as e:
        # 依赖安装失败（RuntimeError 等）需把可读的错误信息返回给前端
        raise HTTPException(status_code=400, detail=str(e))
    return execute_python(req.code, timeout=req.timeout, python_path=python_path)


@router.post("/tasks/{task_id}/run")
def run_task_endpoint(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return run_task(task, db)


@router.post("/tasks/{task_id}/test")
def test_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    prereq_error = check_prerequisite(task, db)
    if prereq_error:
        return {"run_id": None, "status": "failed", "error_message": prereq_error, "result_preview": None, "row_count": None}

    try:
        if task.type == "sql":
            if not task.connection_id:
                raise HTTPException(status_code=400, detail="SQL 任务未关联数据库连接")
            conn = db.get(Connection, task.connection_id)
            if not conn:
                raise HTTPException(status_code=404, detail="连接不存在")
            # 超时使用任务配置，未配置时默认 300 秒
            df = execute_sql(conn, task.content, timeout=task.timeout_seconds or 300)
            return preview_data(df, max_rows=20)
        else:
            python_path = get_effective_python(db)
            ensure_dependencies(task.content, db)
            # 超时使用任务配置，未配置时默认 60 秒
            result = execute_python(
                task.content,
                timeout=task.timeout_seconds or 60,
                python_path=python_path,
            )
            return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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
        from ...services.csv_exporter import export_to_csv
        df = execute_sql(conn, task.content)
        path = export_to_csv(df, task.output_path)
        return {"message": "导出成功", "file_path": path, "row_count": len(df)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tasks/{task_id}/download")
def download_task_csv(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.type != "sql":
        raise HTTPException(status_code=400, detail="只有 SQL 任务可以导出 CSV")
    if not task.connection_id:
        raise HTTPException(status_code=400, detail="任务未关联数据库连接")
    conn = db.get(Connection, task.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="关联连接不存在")
    try:
        import io
        import pandas as pd
        from fastapi.responses import StreamingResponse
        df = execute_sql(conn, task.content)
        buf = io.StringIO()
        df.to_csv(buf, index=False, encoding="utf-8-sig")
        buf.seek(0)
        filename = f"{task.name or 'export'}.csv"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/runs/{run_id}/cancel")
def cancel_task_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(TaskRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="运行记录不存在")
    if run.status != "running":
        raise HTTPException(status_code=400, detail="只有运行中的任务可以取消")

    cancelled = run_tracker.cancel(run_id)

    from datetime import datetime, timezone
    run.status = "failed"
    run.error_message = "用户手动取消"
    run.finished_at = datetime.now(timezone.utc)
    db.commit()

    message = "已取消" if cancelled else "已标记为取消（执行引擎可能仍在收尾）"
    return {"message": message, "run_id": run.id, "cancelled": cancelled}
