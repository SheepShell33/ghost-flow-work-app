import subprocess
import sys
import tempfile
from pathlib import Path

from ..run_tracker import register, unregister


def execute_python(code: str, timeout: int = 60, run_id: int | None = None) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "_exec_script.py"
        script_path.write_text(code, encoding="utf-8")

        process = subprocess.Popen(
            [sys.executable, str(script_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=tmpdir,
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
