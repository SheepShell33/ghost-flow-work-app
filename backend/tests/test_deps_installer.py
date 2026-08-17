"""deps_installer 导入名映射、标准库过滤与安装失败行为测试"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services import deps_installer


def test_import_to_package_mapping():
    """映射表命中：import sklearn / yaml 应安装 scikit-learn / pyyaml"""
    code = "import sklearn\nimport yaml\nimport pandas"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(returncode=0, stdout="", stderr="")
        installed = deps_installer.ensure_dependencies(code)

    assert sorted(installed) == ["pandas", "pyyaml", "scikit-learn"]
    pip_targets = [call.args[0][-1] for call in mock_run.call_args_list]
    assert sorted(pip_targets) == ["pandas", "pyyaml", "scikit-learn"]


def test_stdlib_filtered():
    """标准库不触发安装"""
    code = "import os\nimport json\nfrom pathlib import Path"
    with patch.object(deps_installer.subprocess, "run") as mock_run:
        assert deps_installer.ensure_dependencies(code) == []
        mock_run.assert_not_called()


def test_already_installed_skipped():
    """已安装的包不重复安装"""
    code = "import sklearn"
    with (
        patch.object(deps_installer, "_is_installed", return_value=True),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        assert deps_installer.ensure_dependencies(code) == []
        mock_run.assert_not_called()


def test_install_failure_raises_runtime_error():
    """pip 安装失败抛 RuntimeError，消息含 stderr 摘要"""
    code = "import sklearn"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(
            returncode=1,
            stdout="",
            stderr="一些日志\nERROR: No matching distribution found for scikit-learn",
        )
        with pytest.raises(RuntimeError) as exc_info:
            deps_installer.ensure_dependencies(code)

    message = str(exc_info.value)
    assert "scikit-learn" in message
    assert "No matching distribution" in message


def test_install_subprocess_exception_raises_runtime_error():
    """pip 调用本身异常（如超时）也抛 RuntimeError"""
    code = "import pandas"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(
            deps_installer.subprocess, "run", side_effect=TimeoutError("timed out")
        ),
    ):
        with pytest.raises(RuntimeError, match="pandas"):
            deps_installer.ensure_dependencies(code)


def test_frozen_app_without_system_python_raises_runtime_error():
    """打包环境下找不到系统 Python 时，应给出明确错误而非复用后端可执行文件"""
    code = "import sklearn"
    with (
        patch.object(deps_installer, "_is_frozen_app", return_value=True),
        patch.object(deps_installer, "_find_system_python", return_value=None),
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        with pytest.raises(RuntimeError, match="打包版暂不支持自动安装") as exc_info:
            deps_installer.ensure_dependencies(code)
        mock_run.assert_not_called()
    assert "scikit-learn" in str(exc_info.value)


def test_frozen_app_uses_system_python_when_available():
    """打包环境下存在系统 Python 时，应使用系统 Python 运行 pip"""
    code = "import sklearn"
    with (
        patch.object(deps_installer, "_is_frozen_app", return_value=True),
        patch.object(deps_installer, "_find_system_python", return_value="/usr/bin/python3"),
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer.subprocess, "run") as mock_run,
    ):
        mock_run.return_value = SimpleNamespace(returncode=0, stdout="", stderr="")
        deps_installer.ensure_dependencies(code)

    mock_run.assert_called_once()
    cmd = mock_run.call_args[0][0]
    assert cmd[0] == "/usr/bin/python3"
    assert cmd[1:] == ["-m", "pip", "install", "scikit-learn"]
