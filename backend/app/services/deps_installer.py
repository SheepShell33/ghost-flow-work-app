import ast
import importlib.metadata
import subprocess
import sys
from pathlib import Path

from loguru import logger


def _parse_imports(code: str) -> set[str]:
    """解析 Python 代码中所有 import 的顶层包名"""
    tree = ast.parse(code)
    packages: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                top = alias.name.split(".")[0]
                packages.add(top)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                top = node.module.split(".")[0]
                packages.add(top)

    return packages


def _is_stdlib(name: str) -> bool:
    """判断是否为标准库（基于 Python 内置模块列表）"""
    return name in sys.stdlib_module_names


def _is_installed(package: str) -> bool:
    try:
        importlib.metadata.distribution(package)
        return True
    except importlib.metadata.PackageNotFoundError:
        return False


def ensure_dependencies(code: str) -> list[str]:
    """检查 Python 代码的依赖，自动安装缺失的包，返回安装列表"""
    packages = _parse_imports(code)
    need_install = [
        pkg for pkg in packages
        if not _is_stdlib(pkg) and not _is_installed(pkg)
    ]

    if not need_install:
        return []

    installed = []
    for pkg in need_install:
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", pkg],
                capture_output=True, text=True, timeout=120,
            )
            if result.returncode == 0:
                installed.append(pkg)
                logger.info(f"auto-installed package: {pkg}")
            else:
                logger.warning(f"failed to install {pkg}: {result.stderr}")
        except Exception as e:
            logger.warning(f"failed to install {pkg}: {e}")

    return installed
