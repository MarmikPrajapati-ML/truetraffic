"""TrueTraffic checker API."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .checker import check_domain

app = FastAPI(title="TrueTraffic", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

_INDEX = Path(__file__).parent.parent / "index.html"


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/check")
async def check(domain: str = Query(..., description="Domain to check, e.g. example.com")) -> dict:
    if not domain.strip():
        raise HTTPException(status_code=400, detail="domain is required")
    try:
        return await check_domain(domain)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(_INDEX)
