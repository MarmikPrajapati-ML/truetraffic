"""Gate tests for audit items A1, C2, C3, D3.

A1 gate: no bare numeric precision/accuracy percentages in docs without a citation marker.
C2 gate: /stats returns aggregate rows, not per-visit rows.
C3 gate: SQLite WAL mode is active at startup.
D3 gate: oversized upload returns 413 before the full body is buffered.
"""
from __future__ import annotations

import io
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from collector.api.main import app

client = TestClient(app, raise_server_exceptions=False)

_DOCS_DIR = Path(__file__).parent.parent.parent / "docs"

# ── A1: CI gate — no bare percentage accuracy numbers in docs ─────────────────

_BARE_PCT_RE = re.compile(
    r"~?\d+%\+?\s*(?:precision|accuracy|false.positive|false.negative)",
    re.IGNORECASE,
)


def _check_doc(path: Path) -> list[str]:
    hits: list[str] = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if _BARE_PCT_RE.search(line):
            hits.append(f"{path.name}:{i}: {line.strip()}")
    return hits


@pytest.mark.parametrize("fname", ["HOW_IT_WORKS.md", "FEATURES.md", "OVERVIEW.md", "methodology.md"])
def test_no_bare_numeric_accuracy_claims(fname: str):
    """A1 gate: docs must not contain bare numeric precision/accuracy claims."""
    doc = _DOCS_DIR / fname
    if not doc.exists():
        pytest.skip(f"{fname} not found")
    hits = _check_doc(doc)
    assert not hits, (
        "Remove or qualify these numeric accuracy claims (no labeled dataset exists):\n"
        + "\n".join(hits)
    )


# ── C2 gate: stats endpoint uses SQL aggregation, not per-visit rows ──────────

def _register(domain: str = "gate-test.example.com") -> str:
    r = client.post(f"/sites?domain={domain}")
    return r.json()["site_key"]


def test_stats_returns_aggregate_not_per_visit_rows():
    """C2 gate: the response must contain aggregate counts, not a per-visit list."""
    sk = _register("c2gate.example.com")
    r = client.get(f"/stats/{sk}")
    assert r.status_code == 200
    data = r.json()
    # Must have aggregate counts dict
    assert "counts" in data
    assert isinstance(data["counts"], dict)
    # Must NOT have a list of raw visit objects
    assert "visits" not in data
    # counts must be keyed by classification bucket
    for key in ("human", "suspected_agent", "unknown"):
        assert key in data["counts"]


# ── C3 gate: WAL journal mode is active ──────────────────────────────────────

def test_sqlite_wal_mode_active():
    """C3 gate: confirm PRAGMA journal_mode=WAL is set at startup."""
    from collector.api.db import engine

    if "sqlite" not in str(engine.url):
        pytest.skip("WAL check only applies to SQLite")

    with engine.connect() as conn:
        result = conn.execute(__import__("sqlalchemy").text("PRAGMA journal_mode"))
        mode = result.scalar()
    assert mode == "wal", f"Expected journal_mode=wal, got {mode!r}"


# ── D3 gate: oversized upload raises 413 before full buffering ────────────────

def test_oversized_upload_returns_413():
    """D3 gate: POST /logs/upload must return 413 before reading the full body."""
    chunk = b"x" * 65536  # 64 KB per chunk
    # Build a stream slightly over 100 MB
    num_chunks = (100 * 1024 * 1024 // len(chunk)) + 2
    oversized_stream = io.BytesIO(chunk * num_chunks)

    r = client.post(
        "/logs/upload",
        files={"file": ("big.log", oversized_stream, "text/plain")},
    )
    assert r.status_code == 413, f"Expected 413, got {r.status_code}"
