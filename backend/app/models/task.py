from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="任务名称")
    type: Mapped[str] = mapped_column(String(50), nullable=False, comment="sql | python")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="SQL 或 Python 代码")
    connection_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("connections.id"), nullable=True, comment="关联连接 ID，SQL 任务必填")
    output_path: Mapped[str | None] = mapped_column(String(1024), nullable=True, comment="CSV 导出路径")
    schedule_config: Mapped[str | None] = mapped_column(Text, nullable=True, comment="cron 表达式 JSON")
    prerequisite_task_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tasks.id"), nullable=True, comment="前置任务 ID，运行前需成功执行")
    tags: Mapped[str | None] = mapped_column(String(1024), nullable=True, comment="逗号分隔的标签")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    connection = relationship("Connection", back_populates="tasks")
    # 删除任务时级联删除其运行记录（task_runs.task_id 为 NOT NULL，默认置空会触发约束冲突）
    runs = relationship("TaskRun", back_populates="task", cascade="all, delete-orphan")
