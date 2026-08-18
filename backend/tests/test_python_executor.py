import sys
from pathlib import Path
from unittest import mock

import pytest

from app.services.executor.python_executor import (
    _build_python_cmd,
    _build_python_process_env,
    _is_frozen_app,
    execute_python,
)


def test_is_frozen_app_in_normal_environment():
    assert _is_frozen_app() is False


def test_build_python_cmd_in_normal_environment(tmp_path: Path):
    script_path = tmp_path / "test.py"
    cmd = _build_python_cmd(script_path)
    assert cmd == [sys.executable, str(script_path)]


def test_build_python_process_env_in_normal_environment(tmp_path: Path):
    script_path = tmp_path / "test.py"
    env = _build_python_process_env(script_path)
    assert "GHOST_FLOW_EXEC_SCRIPT" not in env


def test_build_python_cmd_in_frozen_app_with_system_python(tmp_path: Path):
    script_path = tmp_path / "test.py"
    with (
        mock.patch.object(sys, "frozen", True, create=True),
        mock.patch.object(sys, "_MEIPASS", str(tmp_path), create=True),
        mock.patch(
            "app.services.executor.python_executor._find_system_python",
            return_value="/usr/bin/python3",
        ),
    ):
        cmd = _build_python_cmd(script_path)
    assert cmd == ["/usr/bin/python3", str(script_path)]


def test_build_python_cmd_in_frozen_app_without_system_python(tmp_path: Path):
    script_path = tmp_path / "test.py"
    with (
        mock.patch.object(sys, "frozen", True, create=True),
        mock.patch.object(sys, "_MEIPASS", str(tmp_path), create=True),
        mock.patch(
            "app.services.executor.python_executor._find_system_python",
            return_value=None,
        ),
    ):
        with pytest.raises(RuntimeError, match="打包版需要可用的系统 Python"):
            _build_python_cmd(script_path)


def test_build_python_process_env_in_frozen_app(tmp_path: Path):
    script_path = tmp_path / "test.py"
    with mock.patch.object(sys, "frozen", True, create=True):
        with mock.patch.object(sys, "_MEIPASS", str(tmp_path), create=True):
            env = _build_python_process_env(script_path)
    assert "GHOST_FLOW_EXEC_SCRIPT" not in env


def test_execute_python_runs_simple_script():
    result = execute_python("print('hello')", timeout=10)
    assert result["success"] is True
    assert result["exit_code"] == 0
    assert "hello" in result["stdout"]


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
