from datetime import datetime, timezone

from pydantic import BaseModel, field_serializer


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

    @field_serializer('started_at', 'finished_at')
    def serialize_dt(self, dt: datetime | None) -> str | None:
        if dt is None:
            return None
        # 数据库读出的是 naive UTC，统一按 UTC 解析并返回 ISO 8601（带 Z）
        aware_dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        return aware_dt.isoformat().replace('+00:00', 'Z')

    class Config:
        from_attributes = True
