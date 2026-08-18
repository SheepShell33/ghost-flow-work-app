"""Setting 模型测试"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models import Setting


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
