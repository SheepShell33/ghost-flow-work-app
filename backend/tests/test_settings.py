"""Setting 模型与 /api/settings 接口测试"""

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.endpoints.settings import router as settings_router
from app.core.database import Base, get_db
from app.models import Setting
from app.services.python_env import resolve_uv_executable


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


def test_resolve_uv_executable_prefers_env_resources_dir(tmp_path, monkeypatch):
    """GHOST_FLOW_RESOURCES_DIR 存在时优先使用该目录下的 uv.exe"""
    uv_file = tmp_path / "uv.exe"
    uv_file.touch()
    monkeypatch.setenv("GHOST_FLOW_RESOURCES_DIR", str(tmp_path))
    assert resolve_uv_executable() == str(uv_file)


@pytest.fixture
def client():
    """提供使用独立内存 SQLite 数据库的 TestClient。"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(settings_router)
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)


def test_get_settings_returns_defaults(client):
    """未配置时返回默认值，python_ok 为 False"""
    res = client.get("/api/settings")
    assert res.status_code == 200
    assert res.json()["python_executable_path"] is None
    assert res.json()["python_ok"] is False


def test_update_settings_persists_path(client):
    """PUT /api/settings 可持久化 Python 解释器路径"""
    res = client.put("/api/settings", json={"python_executable_path": "/usr/bin/python3"})
    assert res.status_code == 200
    assert res.json()["python_executable_path"] == "/usr/bin/python3"

    res = client.get("/api/settings")
    assert res.json()["python_executable_path"] == "/usr/bin/python3"


def test_test_settings_does_not_persist(client):
    """POST /api/settings/test 不保存路径，仅返回校验结果"""
    with patch(
        "app.api.endpoints.settings.validate_python_env",
        return_value={
            "python_ok": True,
            "python_version": "Python 3.12.0",
            "uv_ok": True,
            "uv_version": "uv 0.4.0",
            "message": "环境检查通过",
        },
    ) as mock_validate:
        res = client.post("/api/settings/test", json={"python_executable_path": "/usr/bin/python3"})
        assert res.status_code == 200
        body = res.json()
        assert body["python_ok"] is True
        assert body["python_version"] == "Python 3.12.0"
        assert body["uv_ok"] is True
        assert body["uv_version"] == "uv 0.4.0"
        assert body["message"] == "环境检查通过"
        mock_validate.assert_called_once_with("/usr/bin/python3")

    # 确认路径未被保存
    res = client.get("/api/settings")
    assert res.status_code == 200
    assert res.json()["python_executable_path"] is None
