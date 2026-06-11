"""SQLAlchemy models — H5 (WAL mode configured in db.py)."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, func

from .db import Base


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    site_key = Column(String(36), unique=True, nullable=False, index=True,
                      default=lambda: str(uuid.uuid4()))
    domain = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    site_key = Column(String(36), nullable=False, index=True)

    webdriver = Column(Boolean, default=False)
    languages_empty = Column(Boolean, default=False)
    plugins_empty = Column(Boolean, default=False)
    headless_ua = Column(Boolean, default=False)
    had_pointer = Column(Boolean, default=False)
    pointer_count = Column(Integer, default=0)
    scroll_depth_pct = Column(Integer, default=0)
    time_to_first_scroll_ms = Column(Float, nullable=True)
    paint_to_interaction_ms = Column(Float, nullable=True)
    viewport_w = Column(Integer, nullable=True)
    viewport_h = Column(Integer, nullable=True)
    screen_w = Column(Integer, nullable=True)
    screen_h = Column(Integer, nullable=True)
    screen_viewport_ratio_ok = Column(Boolean, default=True)

    classification = Column(String(20), default="unknown", index=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)


class LogReport(Base):
    __tablename__ = "log_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(String(36), unique=True, nullable=False, index=True,
                       default=lambda: str(uuid.uuid4()))
    site_key = Column(String(36), nullable=True, index=True)
    status = Column(String(20), default="pending")  # pending | done | error
    report_json = Column(Text, nullable=True)
    error_msg = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
