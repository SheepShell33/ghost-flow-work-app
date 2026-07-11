from pathlib import Path

from sqlalchemy import create_engine

from .base import BaseConnector


class SQLiteConnector(BaseConnector):

    def _create_connection(self, config: dict):
        file_path = config["file_path"]
        if not Path(file_path).exists():
            raise FileNotFoundError(f"SQLite 文件不存在: {file_path}")
        engine = create_engine(f"sqlite:///{file_path}")
        return engine.connect()

    def _cleanup(self, conn):
        conn.close()
