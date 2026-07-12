import json
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as CFTimeoutError

import pandas as pd

from ..connector import get_connector
from ..run_tracker import register, unregister
from ...models.connection import Connection


def execute_sql(
    connection: Connection,
    sql: str,
    timeout: int = 300,
    run_id: int | None = None,
) -> pd.DataFrame:
    config = json.loads(connection.config)
    connector = get_connector(connection.type)

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(connector.execute, config, sql)
        if run_id is not None:
            register(run_id, future)
        try:
            return future.result(timeout=timeout)
        except CFTimeoutError:
            raise TimeoutError(f"SQL 执行超时（{timeout}秒）")
        finally:
            if run_id is not None:
                unregister(run_id)
