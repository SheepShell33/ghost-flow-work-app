import ast
import importlib.metadata
import subprocess
import sys

from loguru import logger

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


def _is_installed(package: str) -> bool:
    try:
        importlib.metadata.distribution(package)
        return True
    except importlib.metadata.PackageNotFoundError:
        return False


def _stderr_summary(stderr: str) -> str:
    """提取 pip stderr 的摘要（最后一行非空内容）"""
    lines = [line.strip() for line in (stderr or "").splitlines() if line.strip()]
    return lines[-1] if lines else "无错误输出"


def ensure_dependencies(code: str) -> list[str]:
    """检查 Python 代码的依赖，自动安装缺失的包，返回安装列表。

    安装失败时抛出 RuntimeError（消息含 pip stderr 摘要），不再静默跳过。
    """
    imports = _parse_imports(code)
    # 先过滤标准库，再做导入名 → 包名映射并去重
    candidates = {
        _resolve_package(name) for name in imports if not _is_stdlib(name)
    }
    need_install = [pkg for pkg in sorted(candidates) if not _is_installed(pkg)]

    if not need_install:
        return []

    installed = []
    for pkg in need_install:
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", pkg],
                capture_output=True, text=True, timeout=120,
            )
        except Exception as e:
            raise RuntimeError(f"依赖安装失败（{pkg}）: {e}") from e
        if result.returncode == 0:
            installed.append(pkg)
            logger.info(f"auto-installed package: {pkg}")
        else:
            raise RuntimeError(f"依赖安装失败（{pkg}）: {_stderr_summary(result.stderr)}")

    return installed
