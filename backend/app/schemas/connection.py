from datetime import datetime

from pydantic import BaseModel, Field


class ConnectionBase(BaseModel):
    name: str = Field(..., max_length=255, description="连接名称")
    type: str = Field(..., pattern=r"^(sqlite|redshift)$", description="sqlite | redshift")
    config: str = Field(..., description="JSON 格式的连接配置")


class ConnectionCreate(ConnectionBase):
    pass


class ConnectionUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    type: str | None = Field(None, pattern=r"^(sqlite|redshift)$")
    config: str | None = None


class ConnectionResponse(ConnectionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
