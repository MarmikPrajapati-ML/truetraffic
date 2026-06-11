"""TrueTraffic checker API."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from shared import logging_cfg
from shared.limiter import limiter

from .checker import SSRFError, check_domain

logging_cfg.configure(os.environ.get("LOG_LEVEL", "INFO"))

_CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "*").split(",")
    if o.strip()
]

app = FastAPI(title="TrueTraffic Checker", version="0.1.0")
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
    allow_methods=["GET"],
    allow_headers=["*"],
)

_INDEX = Path(__file__).parent.parent / "index.html"


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/check")
@limiter.limit("30/minute")
async def check(
    request: Request,
    domain: str = Query(..., max_length=255, description="Domain to check"),
) -> dict:
    if not domain.strip():
        raise HTTPException(400, "domain is required")
    try:
        return await check_domain(domain)
    except SSRFError as exc:
        raise HTTPException(400, f"invalid domain: {exc}") from exc
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc


@app.get("/")
def index() -> FileResponse:
    return FileResponse(_INDEX)
