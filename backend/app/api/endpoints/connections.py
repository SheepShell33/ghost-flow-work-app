import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.connection import Connection
from ...schemas.connection import (
    ConnectionCreate,
    ConnectionResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ConnectionUpdate,
)
from ...services.connector import get_connector

router = APIRouter(prefix="/api/connections", tags=["连接管理"])


@router.get("", response_model=list[ConnectionResponse])
def list_connections(db: Session = Depends(get_db)):
    return db.query(Connection).order_by(Connection.created_at.desc()).all()


@router.post("/test", response_model=ConnectionTestResponse)
def test_connection(data: ConnectionTestRequest):
    """测试连接：不落库，按 type 取 connector 执行 SELECT 1。

    注意：需定义在 /{connection_id} 之前，避免被路径参数路由捕获。
    浏览器 SSO（browser_azure）测试会弹出系统浏览器进行登录。
    """
    try:
        config = json.loads(data.config)
    except json.JSONDecodeError as e:
        return ConnectionTestResponse(success=False, message=f"配置 JSON 解析失败: {e}")

    try:
        connector = get_connector(data.type)
        connector.execute(config, "SELECT 1")
        return ConnectionTestResponse(success=True, message="连接成功")
    except Exception as e:
        return ConnectionTestResponse(success=False, message=f"{type(e).__name__}: {e}")


@router.get("/{connection_id}", response_model=ConnectionResponse)
def get_connection(connection_id: int, db: Session = Depends(get_db)):
    conn = db.get(Connection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="连接不存在")
    return conn


@router.post("", response_model=ConnectionResponse, status_code=201)
def create_connection(data: ConnectionCreate, db: Session = Depends(get_db)):
    conn = Connection(**data.model_dump())
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@router.put("/{connection_id}", response_model=ConnectionResponse)
def update_connection(connection_id: int, data: ConnectionUpdate, db: Session = Depends(get_db)):
    conn = db.get(Connection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="连接不存在")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(conn, key, value)
    db.commit()
    db.refresh(conn)
    return conn


@router.delete("/{connection_id}")
def delete_connection(connection_id: int, db: Session = Depends(get_db)):
    conn = db.get(Connection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="连接不存在")
    db.delete(conn)
    db.commit()
    return {"message": "删除成功"}
