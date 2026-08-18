import os
import subprocess
import sys
import tempfile
from pathlib import Path

from app.services.deps_installer import _find_system_python

from ..run_tracker import register, unregister


def _is_frozen_app() -> bool:
    """判断当前是否运行在 PyInstaller 等打包后的可执行文件内。"""
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def _build_python_process_env(script_path: Path) -> dict[str, str]:
    """构造执行 Python 脚本所需的环境变量。

    开发模式下直接复用当前解释器；打包模式下通过系统 Python 子进程执行脚本，
    因此不再需要将脚本路径通过 GHOST_FLOW_EXEC_SCRIPT 传回后端可执行文件。
    """
    return os.environ.copy()


def _build_python_cmd(script_path: Path) -> list[str]:
    """构造执行 Python 脚本的命令行。

    开发模式下直接调用当前 Python 解释器执行脚本；打包模式下使用系统 Python 解释器，
    确保通过 pip 安装的第三方依赖对脚本可见。
    """
    if _is_frozen_app():
        system_python = _find_system_python()
        if system_python is None:
            raise RuntimeError(
                "打包版需要可用的系统 Python 解释器才能执行 Python 任务；"
                "未检测到可用 Python。请安装 Python 或在开发模式下运行后端。"
            )
        return [system_python, str(script_path)]
    return [sys.executable, str(script_path)]


def execute_python(code: str, timeout: int = 60, run_id: int | None = None) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "_exec_script.py"
        script_path.write_text(code, encoding="utf-8")

        try:
            cmd = _build_python_cmd(script_path)
        except RuntimeError as e:
            return {
                "exit_code": -1,
                "stdout": "",
                "stderr": str(e),
                "success": False,
            }

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=tmpdir,
            env=_build_python_process_env(script_path),
        )
        if run_id is not None:
            register(run_id, process)

        try:
            stdout, stderr = process.communicate(timeout=timeout)
            return {
                "exit_code": process.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "success": process.returncode == 0,
            }
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            return {
                "exit_code": -1,
                "stdout": stdout,
                "stderr": f"执行超时（{timeout}秒）",
                "success": False,
            }
        finally:
            if run_id is not None:
                unregister(run_id)
            if process.poll() is None:
                process.kill()
