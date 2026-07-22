"""add task retry and timeout fields

Revision ID: 599a40c8404b
Revises: 7f002a1f2efa
Create Date: 2026-07-22 22:57:51.759105

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '599a40c8404b'
down_revision: Union[str, None] = '7f002a1f2efa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 仅保留本任务相关的 5 个 add_column，剔除 autogenerate 检测到的无关差异
    # （apscheduler_jobs 表由 APScheduler 自行管理；既有索引/外键差异属于历史库结构，不在本任务范围）
    op.add_column('task_runs', sa.Column('attempt', sa.Integer(), server_default='1', nullable=False, comment='第几次执行（含首次）'))
    op.add_column('task_runs', sa.Column('parent_run_id', sa.Integer(), nullable=True, comment='指向首次运行的 TaskRun id，用于重试归组'))
    op.add_column('tasks', sa.Column('retry_limit', sa.Integer(), server_default='0', nullable=False, comment='失败重试次数（不含首次执行）'))
    op.add_column('tasks', sa.Column('retry_delay', sa.Integer(), server_default='60', nullable=False, comment='重试间隔秒数'))
    op.add_column('tasks', sa.Column('timeout_seconds', sa.Integer(), nullable=True, comment='执行超时秒数，None 使用类型默认值（SQL 300 / Python 60）'))


def downgrade() -> None:
    op.drop_column('tasks', 'timeout_seconds')
    op.drop_column('tasks', 'retry_delay')
    op.drop_column('tasks', 'retry_limit')
    op.drop_column('task_runs', 'parent_run_id')
    op.drop_column('task_runs', 'attempt')
