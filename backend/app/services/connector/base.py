from abc import ABC, abstractmethod

import pandas as pd


class BaseConnector(ABC):

    @abstractmethod
    def _create_connection(self, config: dict):
        """创建底层连接对象（engine/connection），由子类实现"""

    def execute(self, config: dict, sql: str) -> pd.DataFrame:
        conn = self._create_connection(config)
        try:
            return pd.read_sql(sql, conn)
        finally:
            self._cleanup(conn)

    def _cleanup(self, conn):
        """关闭连接，子类可覆盖"""
        try:
            conn.close()
        except Exception:
            pass
