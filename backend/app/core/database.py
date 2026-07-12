from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_migrations():
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    migrations = [
        ("tasks", "prerequisite_task_id", "INTEGER"),
        ("tasks", "tags", "VARCHAR(1024)"),
    ]

    for table, column, col_type in migrations:
        if table in tables:
            cols = {c["name"] for c in inspector.get_columns(table)}
            if column not in cols:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                    conn.commit()


def _ensure_alembic_version():
    """如果数据库已存在业务表但没有 alembic_version，则将其标记为最新版本。

    这样在旧数据库上首次启动时无需手动 `alembic stamp head`，
    同时新环境仍可通过 `alembic upgrade head` 初始化。
    """
    from alembic import command
    from alembic.config import Config

    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "alembic_version" in tables:
        return
    if not tables:
        return

    alembic_ini = Path(__file__).resolve().parent.parent.parent / "alembic.ini"
    if not alembic_ini.exists():
        return

    alembic_cfg = Config(str(alembic_ini))
    command.stamp(alembic_cfg, "head")


def init_db():
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _ensure_alembic_version()
