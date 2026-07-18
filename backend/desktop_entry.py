import os
import sys

import uvicorn

import app.main  # noqa: F401

# PyInstaller onefile extracts bundles to a temp directory; switch cwd there
# so relative datas like alembic/ and static/dist/ resolve correctly.
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    os.chdir(sys._MEIPASS)


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
