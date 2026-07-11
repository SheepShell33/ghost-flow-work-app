from .base import BaseConnector
from .sqlite_connector import SQLiteConnector
from .redshift_connector_impl import RedshiftConnector

CONNECTOR_MAP: dict[str, type[BaseConnector]] = {
    "sqlite": SQLiteConnector,
    "redshift": RedshiftConnector,
}


def get_connector(conn_type: str) -> BaseConnector:
    cls = CONNECTOR_MAP.get(conn_type)
    if not cls:
        raise ValueError(f"不支持的连接类型: {conn_type}")
    return cls()
