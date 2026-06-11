"""Database setup — H5: SQLite in WAL mode, SQLAlchemy so Postgres swap is config-only."""
from __future__ import annotations

import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./truetraffic.db")

_connect_args = {"check_same_thread": False} if "sqlite" in _DATABASE_URL else {}
engine = create_engine(_DATABASE_URL, connect_args=_connect_args)


@event.listens_for(engine, "connect")
def _set_wal_mode(dbapi_conn, _record) -> None:
    if "sqlite" in _DATABASE_URL:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
