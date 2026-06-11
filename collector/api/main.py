"""TrueTraffic collector API — Phase 3."""
from __future__ import annotations

import json
import os
import re
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from shared import logging_cfg
from shared.limiter import limiter

from .classifier import classify
from .db import Base, SessionLocal, engine, get_db
from .log_analyzer import analyze as analyze_log
from .models import LogReport, Site, Visit

logging_cfg.configure(os.environ.get("LOG_LEVEL", "INFO"))
Base.metadata.create_all(bind=engine)

_CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]

_MAX_UPLOAD_BYTES = int(os.environ.get("LOG_MAX_UPLOAD_BYTES", 100 * 1024 * 1024))  # 100 MB
_TMP_DIR = Path(os.environ.get("LOG_TMP_DIR", tempfile.gettempdir()))

app = FastAPI(title="TrueTraffic Collector", version="0.3.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda req, exc: Response(
    content='{"detail":"rate limit exceeded"}',
    status_code=429,
    media_type="application/json",
    headers={"Retry-After": "60"},
))
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_SITE_KEY_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

DB = Annotated[DBSession, Depends(get_db)]


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class BeaconPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_key: str = Field(min_length=36, max_length=36)
    webdriver: bool = False
    languages_empty: bool = False
    plugins_empty: bool = False
    headless_ua: bool = False
    had_pointer: bool = False
    pointer_count: int = Field(default=0, ge=0, le=10_000)
    scroll_depth_pct: int = Field(default=0, ge=0, le=100)
    time_to_first_scroll_ms: float | None = Field(default=None, ge=0, le=3_600_000)
    paint_to_interaction_ms: float | None = Field(default=None, ge=0, le=3_600_000)
    viewport_w: int | None = Field(default=None, ge=0, le=20_000)
    viewport_h: int | None = Field(default=None, ge=0, le=20_000)
    screen_w: int | None = Field(default=None, ge=0, le=20_000)
    screen_h: int | None = Field(default=None, ge=0, le=20_000)
    screen_viewport_ratio_ok: bool = True
    ts: int | None = Field(default=None, ge=0, le=9_999_999_999_999)

    @field_validator("site_key")
    @classmethod
    def _validate_site_key(cls, v: str) -> str:
        if not _SITE_KEY_RE.match(v):
            raise ValueError("site_key must be a UUID")
        return v


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health(db: DB) -> dict:
    """H4: verifies a real DB query."""
    db.execute(func.now() if "sqlite" not in str(engine.url) else func.date("now"))
    return {"status": "ok", "db": str(engine.url).split("///")[-1]}


@app.post("/sites")
@limiter.limit("20/minute")
def register_site(request: Request, domain: str = "", db: DB = None) -> dict:
    if not domain or len(domain) > 255:
        raise HTTPException(400, "domain is required (max 255 chars)")
    site = Site(site_key=str(uuid.uuid4()), domain=domain.lower().strip())
    db.add(site)
    db.commit()
    db.refresh(site)
    return {"site_key": site.site_key, "domain": site.domain}


@app.post("/beacon")
@limiter.limit("120/minute")
def ingest_beacon(request: Request, payload: BeaconPayload, db: DB = None) -> dict:
    site = db.query(Site).filter(Site.site_key == payload.site_key).first()
    if not site:
        raise HTTPException(404, "unknown site_key")

    data = payload.model_dump(exclude={"site_key", "ts"})
    classification = classify(data)

    visit = Visit(site_key=payload.site_key, classification=classification, **data)
    db.add(visit)
    db.commit()
    return {"ok": True}


@app.get("/stats/{site_key}")
@limiter.limit("60/minute")
def get_stats(request: Request, site_key: str, days: int = 30, db: DB = None) -> dict:
    if not _SITE_KEY_RE.match(site_key):
        raise HTTPException(400, "invalid site_key")
    site = db.query(Site).filter(Site.site_key == site_key).first()
    if not site:
        raise HTTPException(404, "unknown site_key")

    since = datetime.utcnow() - timedelta(days=max(1, min(days, 90)))
    visits = (
        db.query(Visit)
        .filter(Visit.site_key == site_key, Visit.created_at >= since)
        .all()
    )

    total = len(visits)
    counts = {"human": 0, "suspected_agent": 0, "unknown": 0}
    daily: dict[str, dict] = {}

    for v in visits:
        counts[v.classification] = counts.get(v.classification, 0) + 1
        day = v.created_at.date().isoformat()
        if day not in daily:
            daily[day] = {"human": 0, "suspected_agent": 0, "unknown": 0, "total": 0}
        daily[day][v.classification] += 1
        daily[day]["total"] += 1

    def pct(n: int) -> float | None:
        return round(n / total * 100, 1) if total else None

    return {
        "site_key": site_key,
        "domain": site.domain,
        "period_days": days,
        "total_sessions": total,
        "human_pct": pct(counts["human"]),
        "suspected_agent_pct": pct(counts["suspected_agent"]),
        "unknown_pct": pct(counts["unknown"]),
        "counts": counts,
        "daily": daily,
        "note": "Measured from JS-executing traffic only. Declared crawler share requires log upload (Phase 3).",
    }


@app.get("/badge/{site_key}.svg", response_class=Response)
@limiter.limit("60/minute")
def badge(request: Request, site_key: str, db: DB = None) -> Response:
    if not _SITE_KEY_RE.match(site_key):
        raise HTTPException(400, "invalid site_key")

    site = db.query(Site).filter(Site.site_key == site_key).first()
    human_pct: float | None = None

    if site:
        since = datetime.utcnow() - timedelta(days=30)
        total = db.query(Visit).filter(
            Visit.site_key == site_key, Visit.created_at >= since
        ).count()
        human = db.query(Visit).filter(
            Visit.site_key == site_key,
            Visit.created_at >= since,
            Visit.classification == "human",
        ).count()
        if total > 0:
            human_pct = round(human / total * 100, 1)

    label = f"{human_pct:.0f}% human" if human_pct is not None else "no data yet"
    color = (
        "#16a34a" if human_pct is not None and human_pct >= 70
        else "#d97706" if human_pct is not None and human_pct >= 40
        else "#dc2626" if human_pct is not None
        else "#9ca3af"
    )
    lw = len(label) * 7 + 10
    total_w = 98 + lw

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="20" role="img" aria-label="{label} · TrueTraffic">
  <title>{label} · verified by TrueTraffic</title>
  <rect width="95" height="20" rx="3" fill="#555"/>
  <rect x="95" width="{lw}" height="20" rx="3" fill="{color}"/>
  <rect x="92" width="6" height="20" fill="{color}"/>
  <text x="6" y="14" font-family="sans-serif" font-size="11" fill="white" font-weight="600">human share</text>
  <text x="100" y="14" font-family="sans-serif" font-size="11" fill="white">{label}</text>
</svg>"""

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ── Log upload / report ───────────────────────────────────────────────────────

def _process_log(report_id: str, tmp_path: Path) -> None:
    """Background task: parse log, persist aggregate, delete temp file (H8)."""
    db = SessionLocal()
    try:
        result = analyze_log(tmp_path)
        report = db.query(LogReport).filter(LogReport.report_id == report_id).first()
        if report:
            report.report_json = json.dumps(result)
            report.status = "done"
            db.commit()
    except Exception as exc:
        report = db.query(LogReport).filter(LogReport.report_id == report_id).first()
        if report:
            report.status = "error"
            report.error_msg = str(exc)[:500]
            db.commit()
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass
        db.close()


@app.post("/logs/upload")
@limiter.limit("5/minute")
async def upload_log(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    site_key: str | None = Form(default=None),
    db: DBSession = Depends(get_db),
) -> dict:
    if site_key and not _SITE_KEY_RE.match(site_key):
        raise HTTPException(400, "invalid site_key format")

    suffix = Path(file.filename or "upload.log").suffix or ".log"
    tmp_path = _TMP_DIR / f"tt_log_{uuid.uuid4().hex}{suffix}"

    try:
        size = 0
        with tmp_path.open("wb") as fh:
            while True:
                chunk = await file.read(65536)
                if not chunk:
                    break
                size += len(chunk)
                if size > _MAX_UPLOAD_BYTES:
                    raise HTTPException(413, f"File exceeds {_MAX_UPLOAD_BYTES // 1_048_576} MB limit")
                fh.write(chunk)
    except HTTPException:
        tmp_path.unlink(missing_ok=True)
        raise

    report = LogReport(
        report_id=str(uuid.uuid4()),
        site_key=site_key,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    background_tasks.add_task(_process_log, report.report_id, tmp_path)

    return {"report_id": report.report_id, "status": "pending"}


@app.get("/logs/report/{report_id}")
@limiter.limit("30/minute")
def get_log_report(request: Request, report_id: str, db: DBSession = Depends(get_db)) -> dict:
    report = db.query(LogReport).filter(LogReport.report_id == report_id).first()
    if not report:
        raise HTTPException(404, "report not found")

    if report.status == "pending":
        return {"report_id": report_id, "status": "pending"}

    if report.status == "error":
        return {"report_id": report_id, "status": "error", "error": report.error_msg}

    return {
        "report_id": report_id,
        "status": "done",
        "data": json.loads(report.report_json or "{}"),
    }
