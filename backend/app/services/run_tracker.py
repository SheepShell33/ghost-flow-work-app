"""运行时任务追踪器。

用于在任务执行期间保存可被外部取消的执行引擎对象（如 subprocess.Popen、
concurrent.futures.Future 等），并提供取消入口。
"""

from __future__ import annotations

import threading
from typing import Any

_lock = threading.Lock()
_engines: dict[int, Any] = {}
_cancelled_run_ids: set[int] = set()


def register(run_id: int, engine: Any) -> None:
    """登记一个正在运行的执行引擎。"""
    with _lock:
        _engines[run_id] = engine


def unregister(run_id: int) -> None:
    """移除执行引擎登记。"""
    with _lock:
        _engines.pop(run_id, None)


def cancel(run_id: int) -> bool:
    """尝试取消指定运行记录对应的执行引擎。

    返回 True 表示已成功发起取消动作；False 表示未找到对应引擎。
    """
    with _lock:
        engine = _engines.get(run_id)
        if engine is None:
            return False
        # 先标记为已取消，确保执行线程能感知到取消事件
        _cancelled_run_ids.add(run_id)

    try:
        if hasattr(engine, "kill"):
            # subprocess.Popen
            engine.kill()
        elif hasattr(engine, "cancel"):
            # concurrent.futures.Future
            engine.cancel()
    except Exception:
        pass

    return True


def pop_cancelled(run_id: int) -> bool:
    """消费指定运行记录的取消标记。返回 True 表示该运行曾被外部取消。"""
    with _lock:
        if run_id in _cancelled_run_ids:
            _cancelled_run_ids.discard(run_id)
            return True
        return False
