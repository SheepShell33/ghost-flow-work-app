from pathlib import Path
import sys
from pydantic import Field
from pydantic_settings import BaseSettings


def _default_base_dir() -> Path:
    """开发时使用项目根目录；PyInstaller 打包后使用 exe 所在目录。"""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "Ghost Flow Work App"
    app_version: str = "0.1.0"
    data_dir: Path = Field(default=_default_base_dir() / "data", alias="GHOST_FLOW_DATA_DIR")
    database_url: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    cors_allow_credentials: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def model_post_init(self, __context):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.database_url:
            self.database_url = f"sqlite:///{self.data_dir / 'app.db'}"


settings = Settings()
