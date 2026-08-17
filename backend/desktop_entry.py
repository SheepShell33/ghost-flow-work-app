import os
import sys
import traceback

# PyInstaller onefile extracts bundles to a temp directory; switch cwd there
# so relative datas like alembic/ and static/dist/ resolve correctly.
_is_frozen_app = getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")
_original_cwd = os.getcwd()
if _is_frozen_app:
    os.chdir(sys._MEIPASS)

# 在 PyInstaller onefile 打包环境下，sys.executable 就是本可执行文件。
# 后端执行 Python 脚本任务时需要复用同一解释器环境，因此通过环境变量进入脚本执行模式，
# 避免再次启动 uvicorn 服务导致端口冲突。
_GHOST_FLOW_EXEC_SCRIPT = os.environ.get("GHOST_FLOW_EXEC_SCRIPT")
if _GHOST_FLOW_EXEC_SCRIPT:
    try:
        # 执行用户脚本时恢复原始工作目录（与开发模式一致，通常为临时目录），
        # 让脚本中的相对路径行为保持一致。
        if _is_frozen_app:
            os.chdir(_original_cwd)
        with open(_GHOST_FLOW_EXEC_SCRIPT, "r", encoding="utf-8") as f:
            script_code = f.read()
        exec_globals = {
            "__name__": "__main__",
            "__file__": _GHOST_FLOW_EXEC_SCRIPT,
            "__builtins__": __builtins__,
        }
        exec(compile(script_code, _GHOST_FLOW_EXEC_SCRIPT, "exec"), exec_globals)
        sys.exit(0)
    except SystemExit as e:
        sys.exit(e.code if isinstance(e.code, int) else 1)
    except Exception:
        traceback.print_exc()
        sys.exit(1)

import uvicorn  # noqa: E402

import app.main  # noqa: F401, E402


def main():
    port = int(os.environ.get("PORT", "17892"))
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
