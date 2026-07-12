from datetime import datetime

from pydantic import BaseModel, Field


class TaskBase(BaseModel):
    name: str = Field(..., max_length=255)
    type: str = Field(..., pattern=r"^(sql|python)$")
    content: str
    connection_id: int | None = None
    output_path: str | None = None
    schedule_config: str | None = None
    prerequisite_task_id: int | None = None
    tags: str | None = None
    enabled: bool = False


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    type: str | None = Field(None, pattern=r"^(sql|python)$")
    content: str | None = None
    connection_id: int | None = None
    output_path: str | None = None
    schedule_config: str | None = None
    prerequisite_task_id: int | None = None
    tags: str | None = None
    enabled: bool | None = None


class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
