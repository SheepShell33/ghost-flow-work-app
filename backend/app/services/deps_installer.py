import ast
import subprocess
import sys

from sqlalchemy.orm import Session

from .python_env import get_effective_python


# 导入名 → pip 包名映射（导入名与包名不一致的常见包）
IMPORT_TO_PACKAGE: dict[str, str] = {
    "sklearn": "scikit-learn",
    "yaml": "pyyaml",
    "PIL": "Pillow",
    "cv2": "opencv-python",
    "bs4": "beautifulsoup4",
}


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


def _resolve_package(import_name: str) -> str:
    """将 import 的模块名映射为 pip 包名（无映射时保持原名）"""
    return IMPORT_TO_PACKAGE.get(import_name, import_name)


def _is_installed(package: str, python_path: str) -> bool:
    """向指定解释器查询包是否已安装。"""
    try:
        result = subprocess.run(
            [python_path, "-c",
             f"import importlib.metadata; importlib.metadata.distribution('{package}')"],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except Exception:
        return False


def check_dependencies(code: str, db: Session) -> list[str]:
    """检查 Python 代码的依赖是否全部已安装，返回缺失的包名列表。

    不会自动安装任何包；调用方应把返回的列表提示给用户，由用户手动安装。
    """
    imports = _parse_imports(code)
    candidates = {_resolve_package(name) for name in imports if not _is_stdlib(name)}

    python_path = get_effective_python(db)
    missing = [pkg for pkg in sorted(candidates) if not _is_installed(pkg, python_path)]

    return missing
