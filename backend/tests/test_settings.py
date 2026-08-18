"""Setting 模型与 /api/settings 接口测试"""

from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.endpoints.settings import router as settings_router
from app.core.database import Base, SessionLocal
from app.models import Setting
from app.services.python_env import resolve_uv_executable


# 独立的 FastAPI 应用用于接口测试，避免启动调度器等副作用
app = FastAPI()
app.include_router(settings_router)
client = TestClient(app)


def _clear_configured_python():
    """清理配置的解释器路径，保证接口测试相互隔离。"""
    db = SessionLocal()
    try:
        setting = db.get(Setting, 1)
        if setting:
            setting.python_executable_path = None
            db.commit()
    finally:
        db.close()


def test_setting_model_import():
    """Setting 模型可通过 app.models 导入"""
    assert Setting is not None
    assert Setting.__tablename__ == "settings"


def test_setting_default_values():
    """Setting 实例具有正确的默认值"""
    setting = Setting()
    assert setting.python_executable_path is None

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    db.add(setting)
    db.commit()
    db.refresh(setting)
    assert setting.id == 1

    db.close()


def test_setting_persist_and_query():
    """Setting 可正确写入并查询"""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    setting = Setting(python_executable_path="/usr/bin/python3")
    db.add(setting)
    db.commit()
    db.refresh(setting)

    assert setting.id == 1
    assert setting.python_executable_path == "/usr/bin/python3"
    assert setting.created_at is not None
    assert setting.updated_at is not None

    queried = db.query(Setting).first()
    assert queried is not None
    assert queried.python_executable_path == "/usr/bin/python3"

    db.close()


def test_resolve_uv_executable_finds_uv_in_path():
    with patch("app.services.python_env.shutil.which", return_value="/usr/bin/uv"):
        assert resolve_uv_executable() == "/usr/bin/uv"


def test_resolve_uv_executable_uses_resource_in_frozen_app():
    fake_exe = "C:\\app\\resources\\ghost-flow-backend.exe"
    with (
        patch("app.services.python_env.getattr", return_value=True),
        patch("app.services.python_env.sys") as mock_sys,
        patch("app.services.python_env.shutil.which", return_value=None),
        patch("app.services.python_env.Path.exists", return_value=True),
    ):
        mock_sys.frozen = True
        mock_sys.executable = fake_exe
        mock_sys._MEIPASS = "C:\\app\\resources\\_MEI"
        assert resolve_uv_executable() == "C:\\app\\resources\\uv.exe"


def test_get_settings_returns_defaults(client=client):
    """未配置时返回默认值，python_ok 为 False"""
    _clear_configured_python()
    res = client.get("/api/settings")
    assert res.status_code == 200
    assert res.json()["python_executable_path"] is None
    assert res.json()["python_ok"] is False


def test_update_settings_persists_path(client=client):
    """PUT /api/settings 可持久化 Python 解释器路径"""
    _clear_configured_python()
    try:
        res = client.put("/api/settings", json={"python_executable_path": "/usr/bin/python3"})
        assert res.status_code == 200
        assert res.json()["python_executable_path"] == "/usr/bin/python3"

        res = client.get("/api/settings")
        assert res.json()["python_executable_path"] == "/usr/bin/python3"
    finally:
        _clear_configured_python()
