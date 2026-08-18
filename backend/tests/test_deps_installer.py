"""deps_installer 导入名映射、标准库过滤与安装失败行为测试"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.services import deps_installer, python_env


def test_import_to_package_mapping():
    """映射表命中：import sklearn / yaml 应安装 scikit-learn / pyyaml"""
    code = "import sklearn\nimport yaml\nimport pandas"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer, "get_effective_python", return_value="/usr/bin/python3"),
        patch.object(deps_installer, "resolve_uv_executable", return_value="/usr/bin/uv"),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(returncode=0, stdout="", stderr="")
        installed = deps_installer.ensure_dependencies(code, MagicMock())

    assert sorted(installed) == ["pandas", "pyyaml", "scikit-learn"]
    pip_targets = [call.args[0][-1] for call in mock_run.call_args_list]
    assert sorted(pip_targets) == ["pandas", "pyyaml", "scikit-learn"]


def test_stdlib_filtered():
    """标准库不触发安装"""
    code = "import os\nimport json\nfrom pathlib import Path"
    with patch.object(deps_installer.subprocess, "run") as mock_run:
        assert deps_installer.ensure_dependencies(code, MagicMock()) == []
        mock_run.assert_not_called()


def test_already_installed_skipped():
    """已安装的包不重复安装"""
    code = "import sklearn"
    with (
        patch.object(deps_installer, "_is_installed", return_value=True),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        assert deps_installer.ensure_dependencies(code, MagicMock()) == []
        mock_run.assert_not_called()


def test_install_failure_raises_runtime_error():
    """uv 安装失败抛 RuntimeError，消息含 stderr 摘要"""
    code = "import sklearn"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer, "get_effective_python", return_value="/usr/bin/python3"),
        patch.object(deps_installer, "resolve_uv_executable", return_value="/usr/bin/uv"),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(
            returncode=1,
            stdout="",
            stderr="一些日志\nERROR: No matching distribution found for scikit-learn",
        )
        with pytest.raises(RuntimeError) as exc_info:
            deps_installer.ensure_dependencies(code, MagicMock())

    message = str(exc_info.value)
    assert "scikit-learn" in message
    assert "No matching distribution" in message


def test_install_subprocess_exception_raises_runtime_error():
    """uv 调用本身异常（如超时）也抛 RuntimeError"""
    code = "import pandas"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer, "get_effective_python", return_value="/usr/bin/python3"),
        patch.object(deps_installer, "resolve_uv_executable", return_value="/usr/bin/uv"),
        patch.object(
            deps_installer.subprocess, "run", side_effect=TimeoutError("timed out")
        ),
    ):
        with pytest.raises(RuntimeError, match="pandas"):
            deps_installer.ensure_dependencies(code, MagicMock())


def test_find_system_python_rejects_broken_alias():
    """应跳过 Windows Store 伪别名等无法运行的 python 可执行文件"""
    fake_path = "C:\\WindowsApps\\python.exe"
    with (
        patch.object(deps_installer.shutil, "which", return_value=fake_path),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(
            returncode=49,
            stdout="",
            stderr="Python was not found; run without arguments to install from the Microsoft Store",
        )
        assert deps_installer._find_system_python() is None


def test_find_system_python_accepts_working_interpreter():
    """可正常运行的 Python 解释器应被返回"""
    fake_path = "/usr/bin/python3"
    with (
        patch.object(deps_installer.shutil, "which", return_value=fake_path),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(
            returncode=0,
            stdout="Python 3.12.0",
            stderr="",
        )
        assert deps_installer._find_system_python() == fake_path


def test_ensure_dependencies_uses_configured_python():
    """ensure_dependencies 应使用 get_effective_python 返回的解释器，并用 uv 安装依赖"""
    code = "import pandas"
    fake_python = "/usr/bin/python3"
    fake_uv = "/usr/bin/uv"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer, "get_effective_python", return_value=fake_python),
        patch.object(deps_installer, "resolve_uv_executable", return_value=fake_uv),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(returncode=0, stdout="", stderr="")
        deps_installer.ensure_dependencies(code, MagicMock())

    cmd = mock_run.call_args[0][0]
    assert cmd[:5] == [fake_uv, "pip", "install", "--python", fake_python]


def test_frozen_app_without_configured_python_raises_runtime_error():
    """打包环境下未配置 Python 解释器时，get_effective_python 应抛出明确错误"""
    with (
        patch.object(python_env, "_is_frozen_app", return_value=True),
        patch.object(python_env, "get_configured_python", return_value=None),
    ):
        with pytest.raises(RuntimeError, match="打包版未配置 Python 解释器路径"):
            deps_installer.get_effective_python(MagicMock())


def test_frozen_app_uses_configured_python_when_available():
    """打包环境下配置了 Python 解释器时，应使用该解释器"""
    configured_python = "/usr/bin/python3"
    with (
        patch.object(python_env, "_is_frozen_app", return_value=True),
        patch.object(python_env, "get_configured_python", return_value=configured_python),
    ):
        assert deps_installer.get_effective_python(MagicMock()) == configured_python
