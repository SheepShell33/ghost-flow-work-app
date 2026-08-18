import ast
import subprocess
import sys

from loguru import logger
from sqlalchemy.orm import Session

from .python_env import get_effective_python, resolve_uv_executable


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


def _stderr_summary(stderr: str) -> str:
    """提取 stderr 的摘要（最后一行非空内容）"""
    lines = [line.strip() for line in (stderr or "").splitlines() if line.strip()]
    return lines[-1] if lines else "无错误输出"


def ensure_dependencies(code: str, db: Session) -> list[str]:
    """检查 Python 代码的依赖，自动安装缺失的包，返回安装列表。

    安装失败时抛出 RuntimeError（消息含 stderr 摘要），不再静默跳过。
    使用配置的解释器（未配置时使用当前 Python 解释器），并通过 uv 安装依赖。
    """
    imports = _parse_imports(code)
    candidates = {_resolve_package(name) for name in imports if not _is_stdlib(name)}

    python_path = get_effective_python(db)
    need_install = [pkg for pkg in sorted(candidates) if not _is_installed(pkg, python_path)]

    if not need_install:
        return []

    uv_path = resolve_uv_executable()
    if not uv_path:
        raise RuntimeError("未找到 uv 可执行文件，无法自动安装第三方依赖。")

    installed = []
    for pkg in need_install:
        try:
            result = subprocess.run(
                [uv_path, "pip", "install", "--python", python_path, pkg],
                capture_output=True, text=True, timeout=120,
            )
        except Exception as e:
            raise RuntimeError(f"依赖安装失败（{pkg}）: {e}") from e
        if result.returncode == 0:
            installed.append(pkg)
            logger.info(f"auto-installed package: {pkg} into {python_path}")
        else:
            raise RuntimeError(f"依赖安装失败（{pkg}）: {_stderr_summary(result.stderr)}")

    return installed
