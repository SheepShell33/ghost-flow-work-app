"""系统设置相关 API。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...schemas.setting import SettingResponse, SettingTestResponse, SettingUpdate
from ...services.python_env import (
    get_configured_python,
    get_or_create_settings,
    validate_python_env,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingResponse)
def get_settings(db: Session = Depends(get_db)):
    path = get_configured_python(db)
    validation = validate_python_env(path)
    return SettingResponse(
        python_executable_path=path,
        python_ok=validation["python_ok"],
        uv_ok=validation["uv_ok"],
    )


@router.put("", response_model=SettingResponse)
def update_settings(req: SettingUpdate, db: Session = Depends(get_db)):
    setting = get_or_create_settings(db)
    value = req.python_executable_path
    setting.python_executable_path = (value.strip() or None) if value else None
    db.commit()
    db.refresh(setting)
    path = get_configured_python(db)
    validation = validate_python_env(path)
    return SettingResponse(
        python_executable_path=path,
        python_ok=validation["python_ok"],
        uv_ok=validation["uv_ok"],
    )


@router.post("/test", response_model=SettingTestResponse)
def test_settings(req: SettingUpdate):
    path = req.python_executable_path.strip() if req.python_executable_path else None
    return SettingTestResponse(**validate_python_env(path))
