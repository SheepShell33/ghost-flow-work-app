"""Python 环境解析与校验服务。"""

import shutil
import subprocess
import sys
from pathlib import Path

from loguru import logger
from sqlalchemy.orm import Session

from ..models.setting import Setting


def _is_frozen_app() -> bool:
    """判断当前是否运行在 PyInstaller 打包后的可执行文件中。"""
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def get_or_create_settings(db: Session) -> Setting:
    """获取或创建 id 为 1 的系统设置记录。"""
    setting = db.get(Setting, 1)
    if setting is None:
        setting = Setting(id=1)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def get_configured_python(db: Session) -> str | None:
    """返回用户配置的 Python 解释器路径，未配置时返回 None。"""
    setting = get_or_create_settings(db)
    path = setting.python_executable_path
    if not path:
        return None
    return path.strip() or None


def resolve_uv_executable() -> str | None:
    """解析可用的 uv 可执行文件路径。"""
    if _is_frozen_app():
        bundled = Path(sys.executable).parent / "uv.exe"
        if bundled.exists():
            return str(bundled)
    return shutil.which("uv")


def validate_python_env(python_path: str | None) -> dict:
    """校验指定的 Python 解释器与 uv 是否可用，返回检查结果字典。"""
    result = {
        "python_ok": False,
        "python_version": None,
        "uv_ok": False,
        "uv_version": None,
        "message": "",
    }

    if not python_path:
        result["message"] = "未配置 Python 解释器路径"
        return result

    try:
        proc = subprocess.run(
            [python_path, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode == 0 and proc.stdout.startswith("Python "):
            result["python_ok"] = True
            result["python_version"] = proc.stdout.strip()
        else:
            result["message"] = "指定的 Python 解释器无法运行"
            return result
    except Exception as e:
        result["message"] = f"检查 Python 解释器时出错：{e}"
        return result

    uv_path = resolve_uv_executable()
    if not uv_path:
        result["message"] = "未找到 uv 可执行文件"
        return result

    try:
        proc = subprocess.run(
            [uv_path, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode == 0:
            result["uv_ok"] = True
            result["uv_version"] = proc.stdout.strip() or proc.stderr.strip()
        else:
            result["message"] = "uv 可执行文件无法运行"
            return result
    except Exception as e:
        result["message"] = f"检查 uv 时出错：{e}"
        return result

    result["message"] = "环境检查通过"
    return result


def get_effective_python(db: Session) -> str:
    """返回实际生效的 Python 解释器路径。"""
    configured = get_configured_python(db)
    if configured:
        return configured
    if _is_frozen_app():
        raise RuntimeError(
            "打包版未配置 Python 解释器路径，请在“系统设置”中配置可用的 Python 环境。"
        )
    return sys.executable
