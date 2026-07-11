from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="任务名称")
    type: Mapped[str] = mapped_column(String(50), nullable=False, comment="sql | python")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="SQL 或 Python 代码")
    connection_id: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="关联连接 ID，SQL 任务必填")
    output_path: Mapped[str | None] = mapped_column(String(1024), nullable=True, comment="CSV 导出路径")
    schedule_config: Mapped[str | None] = mapped_column(Text, nullable=True, comment="cron 表达式 JSON")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
