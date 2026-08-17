import os
import subprocess
import sys
import tempfile
from pathlib import Path

from ..run_tracker import register, unregister


def _is_frozen_app() -> bool:
    """判断当前是否运行在 PyInstaller 等打包后的可执行文件内。"""
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def _build_python_process_env(script_path: Path) -> dict[str, str]:
    """构造执行 Python 脚本所需的环境变量。

    在 PyInstaller onefile 打包环境下，sys.executable 指向的是后端可执行文件本身，
    直接用它运行脚本会再次启动后端服务并导致端口冲突。此时通过 GHOST_FLOW_EXEC_SCRIPT
    环境变量让后端可执行文件进入脚本执行模式。
    """
    env = os.environ.copy()
    if _is_frozen_app():
        env["GHOST_FLOW_EXEC_SCRIPT"] = str(script_path)
    return env


def _build_python_cmd(script_path: Path) -> list[str]:
    """构造执行 Python 脚本的命令行。

    开发模式下直接调用当前 Python 解释器执行脚本；打包模式下当前可执行文件就是解释器入口，
    由 GHOST_FLOW_EXEC_SCRIPT 环境变量决定执行脚本，避免重复传入脚本路径。
    """
    if _is_frozen_app():
        return [sys.executable]
    return [sys.executable, str(script_path)]


def execute_python(code: str, timeout: int = 60, run_id: int | None = None) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "_exec_script.py"
        script_path.write_text(code, encoding="utf-8")

        process = subprocess.Popen(
            _build_python_cmd(script_path),
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
