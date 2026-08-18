"""Setting 相关 Pydantic schema。"""

from pydantic import BaseModel, Field


class SettingUpdate(BaseModel):
    python_executable_path: str | None = Field(default=None, max_length=1024)


class SettingResponse(BaseModel):
    python_executable_path: str | None
    python_ok: bool
    uv_ok: bool


class SettingTestResponse(BaseModel):
    python_ok: bool
    python_version: str | None
    uv_ok: bool
    uv_version: str | None
    message: str
