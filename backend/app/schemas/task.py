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
    retry_limit: int = Field(0, ge=0, description="失败重试次数")
    retry_delay: int = Field(60, ge=0, description="重试间隔秒数")
    timeout_seconds: int | None = Field(None, ge=1, description="执行超时秒数，None 用默认值")


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
    retry_limit: int | None = Field(None, ge=0)
    retry_delay: int | None = Field(None, ge=0)
    timeout_seconds: int | None = Field(None, ge=1)


class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
