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
    """构造执行 Python 脚本所需的环境变量。"""
    return os.environ.copy()


def _build_python_cmd(script_path: Path, python_path: str | None = None) -> list[str]:
    """构造执行 Python 脚本的命令行。"""
    return [python_path or sys.executable, str(script_path)]


def execute_python(
    code: str,
    timeout: int = 60,
    run_id: int | None = None,
    python_path: str | None = None,
) -> dict:
    """在指定 Python 解释器中执行代码片段。

    参数:
        code: 待执行的 Python 源码。
        timeout: 执行超时时间（秒）。
        run_id: 运行记录 ID，用于取消追踪；不传则不追踪。
        python_path: 执行使用的 Python 解释器路径；未传时使用当前解释器。
    """
    if python_path is None:
        python_path = sys.executable

    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "_exec_script.py"
        script_path.write_text(code, encoding="utf-8")

        cmd = _build_python_cmd(script_path, python_path)
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
