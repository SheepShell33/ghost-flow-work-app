import sys
from pathlib import Path

import pytest

from app.services.executor.python_executor import (
    _build_python_cmd,
    _build_python_process_env,
    execute_python,
)


def test_build_python_cmd_in_normal_environment(tmp_path: Path):
    script_path = tmp_path / "test.py"
    cmd = _build_python_cmd(script_path)
    assert cmd == [sys.executable, str(script_path)]


def test_build_python_cmd_uses_provided_python_path(tmp_path: Path):
    script_path = tmp_path / "test.py"
    cmd = _build_python_cmd(script_path, python_path="/usr/bin/python3")
    assert cmd == ["/usr/bin/python3", str(script_path)]


def test_build_python_process_env_in_normal_environment(tmp_path: Path):
    script_path = tmp_path / "test.py"
    env = _build_python_process_env(script_path)
    assert "GHOST_FLOW_EXEC_SCRIPT" not in env


def test_execute_python_runs_simple_script():
    result = execute_python("print('hello')", timeout=10)
    assert result["success"] is True
    assert result["exit_code"] == 0
    assert "hello" in result["stdout"]


def test_execute_python_uses_provided_python_path():
    result = execute_python(
        "import sys; print(sys.executable)",
        timeout=10,
        python_path=sys.executable,
    )
    assert result["success"] is True
    assert sys.executable in result["stdout"]


def test_execute_python_returns_stderr_on_failure():
    result = execute_python("raise ValueError('oops')", timeout=10)
    assert result["success"] is False
    assert result["exit_code"] != 0
    assert "oops" in result["stderr"]


def test_execute_python_respects_timeout():
    result = execute_python("import time; time.sleep(10)", timeout=1)
    assert result["success"] is False
    assert result["exit_code"] == -1
    assert "超时" in result["stderr"]
