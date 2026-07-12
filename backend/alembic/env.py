from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.core.database import Base, engine
from app import models  # noqa: F401  确保模型注册到 Base.metadata

# 读取 alembic.ini 中的日志配置
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 目标元数据，用于自动生成迁移脚本
target_metadata = Base.metadata

# 使用应用配置的数据库 URL
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    """离线模式：不建立真实连接，直接生成 SQL。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：通过应用引擎执行迁移。"""
    connectable = engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
