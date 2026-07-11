import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError

import pandas as pd

from ..connector import get_connector
from ...models.connection import Connection


def execute_sql(connection: Connection, sql: str, timeout: int = 300) -> pd.DataFrame:
    config = json.loads(connection.config)
    connector = get_connector(connection.type)

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(connector.execute, config, sql)
        try:
            return future.result(timeout=timeout)
        except TimeoutError:
            raise TimeoutError(f"SQL 执行超时（{timeout}秒）")
