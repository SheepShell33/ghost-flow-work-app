from datetime import datetime

from pydantic import BaseModel


class TaskRunResponse(BaseModel):
    id: int
    task_id: int
    status: str
    error_message: str | None = None
    result_preview: str | None = None
    row_count: int | None = None
    attempt: int = 1
    parent_run_id: int | None = None
    started_at: datetime
    finished_at: datetime | None = None

    class Config:
        from_attributes = True
