from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Ghost Flow Work App"
    app_version: str = "0.1.0"
    database_url: str = f"sqlite:///{Path(__file__).resolve().parent.parent.parent.parent / 'data' / 'app.db'}"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    cors_allow_credentials: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
