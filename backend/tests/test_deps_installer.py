"""deps_installer 导入名映射、标准库过滤与缺失检查测试"""

from unittest.mock import MagicMock, patch

import pytest

from app.services import deps_installer, python_env


def test_import_to_package_mapping():
    """映射表命中：import sklearn / yaml 应识别为 scikit-learn / pyyaml"""
    code = "import sklearn\nimport yaml\nimport pandas"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer, "get_effective_python", return_value="/usr/bin/python3"),
    ):
        missing = deps_installer.check_dependencies(code, MagicMock())

    assert sorted(missing) == ["pandas", "pyyaml", "scikit-learn"]


def test_stdlib_filtered():
    """标准库不进入缺失检查"""
    code = "import os\nimport json\nfrom pathlib import Path"
    with patch.object(deps_installer, "_is_installed") as mock_is_installed:
        assert deps_installer.check_dependencies(code, MagicMock()) == []
        mock_is_installed.assert_not_called()


def test_already_installed_skipped():
    """已安装的包不进入缺失列表"""
    code = "import sklearn"
    with (
        patch.object(deps_installer, "_is_installed", return_value=True),
        patch.object(deps_installer, "get_effective_python", return_value="/usr/bin/python3"),
    ):
        assert deps_installer.check_dependencies(code, MagicMock()) == []


def test_missing_packages_reported():
    """未安装的包返回在缺失列表中"""
    code = "import pandas"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False),
        patch.object(deps_installer, "get_effective_python", return_value="/usr/bin/python3"),
    ):
        missing = deps_installer.check_dependencies(code, MagicMock())

    assert missing == ["pandas"]


def test_check_dependencies_uses_configured_python():
    """check_dependencies 应使用 get_effective_python 返回的解释器检查安装状态"""
    code = "import pandas"
    fake_python = "/usr/bin/python3"
    with (
        patch.object(deps_installer, "_is_installed", return_value=False) as mock_is_installed,
        patch.object(deps_installer, "get_effective_python", return_value=fake_python) as mock_get_python,
    ):
        deps_installer.check_dependencies(code, MagicMock())

    mock_get_python.assert_called_once()
    mock_is_installed.assert_called_once_with("pandas", fake_python)


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
