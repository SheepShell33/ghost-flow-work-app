"""POST /api/connections/test 端点测试"""

import json
import sqlite3

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.endpoints.connections import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def test_sqlite_success(tmp_path):
    """sqlite 连接成功路径"""
    db_file = tmp_path / "ok.db"
    sqlite3.connect(db_file).close()

    resp = client.post(
        "/api/connections/test",
        json={"type": "sqlite", "config": json.dumps({"file_path": str(db_file)})},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["message"]


def test_sqlite_missing_params_failure():
    """参数缺失失败路径：config 为空 JSON，sqlite 连接器缺 file_path"""
    resp = client.post(
        "/api/connections/test",
        json={"type": "sqlite", "config": "{}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert body["message"]


def test_sqlite_file_not_found_failure(tmp_path):
    """文件不存在失败路径"""
    resp = client.post(
        "/api/connections/test",
        json={"type": "sqlite", "config": json.dumps({"file_path": str(tmp_path / "nope.db")})},
    )
    body = resp.json()
    assert body["success"] is False
    assert "不存在" in body["message"]


def test_invalid_json_config():
    """config 不是合法 JSON 时返回失败而非 500"""
    resp = client.post(
        "/api/connections/test",
        json={"type": "sqlite", "config": "not-a-json"},
    )
    body = resp.json()
    assert body["success"] is False
    assert "JSON" in body["message"]


def test_unknown_type_failure():
    """未知连接类型返回失败"""
    resp = client.post(
        "/api/connections/test",
        json={"type": "oracle", "config": "{}"},
    )
    body = resp.json()
    assert body["success"] is False
    assert "不支持" in body["message"]
