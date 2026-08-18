import ast
import importlib.metadata
import shutil
import subprocess
import sys

from loguru import logger


def _is_frozen_app() -> bool:
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def _is_valid_python(path: str) -> bool:
    """验证路径对应的 Python 解释器真的可以运行（排除 Windows Store 伪别名等）。"""
    try:
        result = subprocess.run(
            [path, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except Exception:
        return False
    return result.returncode == 0 and result.stdout.startswith("Python ")


def _find_system_python() -> str | None:
    """在 PATH 中查找可用的系统 Python 解释器（打包环境 fallback）。"""
    for cmd in ("python3", "python"):
        path = shutil.which(cmd)
        if path and _is_valid_python(path):
            return path
    return None

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
    在 PyInstaller onefile 打包环境下，sys.executable 指向后端可执行文件本身，不能直接用
    作 pip 解释器，因此优先查找系统 Python；找不到时提示用户预装依赖或改用开发模式运行。
    """
    imports = _parse_imports(code)
    # 先过滤标准库，再做导入名 → 包名映射并去重
    candidates = {
        _resolve_package(name) for name in imports if not _is_stdlib(name)
    }
    need_install = [pkg for pkg in sorted(candidates) if not _is_installed(pkg)]

    if not need_install:
        return []

    pip_python = sys.executable
    if _is_frozen_app():
        system_python = _find_system_python()
        if system_python is None:
            raise RuntimeError(
                f"打包版暂不支持自动安装第三方依赖：{', '.join(need_install)}。"
                "请使用系统 Python 预装这些包，或在开发模式下运行后端。"
            )
        pip_python = system_python

    installed = []
    for pkg in need_install:
        try:
            result = subprocess.run(
                [pip_python, "-m", "pip", "install", pkg],
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
