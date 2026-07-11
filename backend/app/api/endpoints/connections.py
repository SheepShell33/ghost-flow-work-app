from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.connection import Connection
from ...schemas.connection import ConnectionCreate, ConnectionResponse, ConnectionUpdate

router = APIRouter(prefix="/api/connections", tags=["连接管理"])


@router.get("", response_model=list[ConnectionResponse])
def list_connections(db: Session = Depends(get_db)):
    return db.query(Connection).order_by(Connection.created_at.desc()).all()


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
