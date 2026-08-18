"""Python 环境解析与校验服务。"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from ..models.setting import Setting


def _is_frozen_app() -> bool:
    """判断当前是否运行在 PyInstaller 打包后的可执行文件中。"""
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def get_or_create_settings(db: Session) -> Setting:
    """获取或创建 id 为 1 的系统设置记录。"""
    setting = db.get(Setting, 1)
    if setting is not None:
        return setting
    db.execute(
        sqlite_insert(Setting)
        .values(id=1)
        .on_conflict_do_nothing(index_elements=["id"])
    )
    db.commit()
    setting = db.get(Setting, 1)
    if setting is None:  # pragma: no cover
        raise RuntimeError("无法创建 settings 记录")
    return setting


def get_configured_python(db: Session) -> str | None:
    """返回用户配置的 Python 解释器路径，未配置时返回 None。"""
    setting = get_or_create_settings(db)
    path = setting.python_executable_path
    if not path:
        return None
    return path.strip() or None


def resolve_uv_executable() -> str | None:
    """解析可用的 uv 可执行文件路径。

    打包版运行时，Electron 通过 GHOST_FLOW_RESOURCES_DIR 把资源目录传给后端，
    因此优先从该目录查找随包分发的 uv.exe；否则回退到系统 PATH 中的 uv。
    """
    resources_dir = os.environ.get("GHOST_FLOW_RESOURCES_DIR")
    if resources_dir:
        bundled = Path(resources_dir) / "uv.exe"
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


def list_installed_packages(python_path: str) -> list[dict[str, str]]:
    """列出指定 Python 环境中已安装的第三方包及其版本。

    使用 `pip list --format=json` 获取；若调用失败则返回空列表。
    """
    try:
        proc = subprocess.run(
            [python_path, "-m", "pip", "list", "--format=json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0:
            return []
        import json
        data = json.loads(proc.stdout)
        return sorted(
            [{"name": item["name"], "version": item["version"]} for item in data],
            key=lambda x: x["name"].lower(),
        )
    except Exception:
        return []
