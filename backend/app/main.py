from contextlib import asynccontextmanager
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.router import api_router
from .core.config import settings
from .core.database import init_db, SessionLocal
from .models.task_run import TaskRun
from .services.scheduler import init_scheduler, shutdown_scheduler
from .core.logging import setup_logging

logger = setup_logging(str(settings.data_dir / "logs"))


def _reset_stale_runs():
    """服务启动时，将上次异常中断后仍标记为 running 的运行记录置为失败。"""
    from datetime import datetime, timezone

    db = SessionLocal()
    try:
        stale = db.query(TaskRun).filter(TaskRun.status == "running").all()
        if stale:
            for run in stale:
                run.status = "failed"
                run.error_message = "服务重启导致运行中断"
                run.finished_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"reset {len(stale)} stale running task runs")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting up...")
    init_db()
    _reset_stale_runs()
    init_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": settings.app_version}


def _get_static_dir() -> Path | None:
    """查找前端静态资源目录：开发时或 PyInstaller onefile 临时目录。"""
    # 开发模式：backend/static/dist
    dev_static = Path(__file__).resolve().parent.parent / "static" / "dist"
    if dev_static.exists():
        return dev_static
    # PyInstaller onefile 解压目录
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        bundle_static = Path(meipass) / "static" / "dist"
        if bundle_static.exists():
            return bundle_static
    return None


_static_dir = _get_static_dir()
if _static_dir:
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
