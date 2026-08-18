"""Setting 模型测试"""

from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
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
