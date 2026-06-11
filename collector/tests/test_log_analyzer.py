"""Phase 3 tests — log_analyzer streaming, format detection, H8 cleanup."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from collector.api.log_analyzer import analyze, detect_format

SAMPLE_COMBINED = (
    '66.249.64.1 - - [10/Jan/2025:12:00:00 +0000] '
    '"GET /blog/post-1 HTTP/1.1" 200 5120 '
    '"-" "Googlebot/2.1 (+http://www.google.com/bot.html)"\n'
    '203.0.113.5 - - [10/Jan/2025:12:01:00 +0000] '
    '"GET / HTTP/1.1" 200 2048 '
    '"-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"\n'
    "THIS LINE IS MALFORMED\n"
)

SAMPLE_CF_CSV = (
    "ClientIP,ClientRequestUserAgent,ClientRequestURI,EdgeResponseBytes,EdgeResponseStatus,EdgeStartTimestamp\n"
    '66.249.64.1,"Googlebot/2.1 (+http://www.google.com/bot.html)",/page,4096,200,2025-01-10T12:00:00Z\n'
    '203.0.113.5,"Mozilla/5.0 (compatible; Bingbot/2.0)",/other,1024,200,2025-01-10T12:01:00Z\n'
    '1.2.3.4,"Mozilla/5.0 (Windows NT 10.0)",/index,512,200,2025-01-10T12:02:00Z\n'
)


@pytest.fixture()
def agents_file(tmp_path, monkeypatch) -> Path:
    agents = [
        {
            "name": "Googlebot",
            "vendor": "Google",
            "category": "search",
            "user_agent_pattern": "Googlebot",
        },
        {
            "name": "Bingbot",
            "vendor": "Microsoft",
            "category": "search",
            "user_agent_pattern": "Bingbot",
        },
    ]
    p = tmp_path / "ai-agents.json"
    p.write_text(json.dumps(agents))
    monkeypatch.setenv("AGENTS_PATH", str(p))
    import importlib

    import collector.api.log_analyzer as la
    importlib.reload(la)
    return p


def _write_tmp(content: str, suffix: str = ".log") -> Path:
    tf = tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False, encoding="utf-8")
    tf.write(content)
    tf.flush()
    tf.close()
    return Path(tf.name)


# ── format detection ──────────────────────────────────────────────────────────

def test_detect_cloudflare():
    assert detect_format("ClientIP,ClientRequestUserAgent,ClientRequestURI") == "cloudflare_csv"


def test_detect_combined():
    assert detect_format('66.249.64.1 - - [10/Jan/2025:12:00:00 +0000] "GET / HTTP/1.1" 200 1234') == "combined"


# ── combined log ──────────────────────────────────────────────────────────────

def test_combined_total_requests(agents_file):
    p = _write_tmp(SAMPLE_COMBINED)
    try:
        from collector.api.log_analyzer import analyze
        r = analyze(p)
        assert r["total_requests"] == 2  # malformed line not counted
        assert r["malformed_lines"] == 1
    finally:
        p.unlink(missing_ok=True)


def test_combined_bot_detected(agents_file):
    p = _write_tmp(SAMPLE_COMBINED)
    try:
        from collector.api.log_analyzer import analyze
        r = analyze(p)
        assert r["bot_requests"] == 1
        names = [b["name"] for b in r["bot_breakdown"]]
        assert "Googlebot" in names
    finally:
        p.unlink(missing_ok=True)


def test_combined_non_ai_crawler_requests(agents_file):
    """A2 gate: log layer cannot measure humans; field must be non_ai_crawler_requests."""
    p = _write_tmp(SAMPLE_COMBINED)
    try:
        from collector.api.log_analyzer import analyze
        r = analyze(p)
        assert "human_requests" not in r, "field must not be named human_requests"
        assert r["non_ai_crawler_requests"] == 1
    finally:
        p.unlink(missing_ok=True)


# ── Cloudflare CSV ────────────────────────────────────────────────────────────

def test_cloudflare_format_detected(agents_file):
    p = _write_tmp(SAMPLE_CF_CSV, suffix=".csv")
    try:
        from collector.api.log_analyzer import analyze
        r = analyze(p)
        assert r["format_detected"] == "cloudflare_csv"
    finally:
        p.unlink(missing_ok=True)


def test_cloudflare_bot_detected(agents_file):
    p = _write_tmp(SAMPLE_CF_CSV, suffix=".csv")
    try:
        from collector.api.log_analyzer import analyze
        r = analyze(p)
        assert r["bot_requests"] == 2  # Googlebot + Bingbot
        names = {b["name"] for b in r["bot_breakdown"]}
        assert {"Googlebot", "Bingbot"} == names
    finally:
        p.unlink(missing_ok=True)


# ── H8: temp file cleanup ─────────────────────────────────────────────────────

def test_h8_caller_cleanup(agents_file):
    p = _write_tmp(SAMPLE_COMBINED)
    analyze(p)
    # File must still exist — analyze() does NOT delete it; caller does
    assert p.exists(), "analyze() must not delete the temp file; caller is responsible (H8)"
    p.unlink()


# ── H1: wall-clock timeout ────────────────────────────────────────────────────

def test_timeout_sets_flag(monkeypatch, agents_file):
    monkeypatch.setenv("LOG_PARSE_TIMEOUT", "0")
    import importlib

    import collector.api.log_analyzer as la
    importlib.reload(la)

    p = _write_tmp(SAMPLE_COMBINED * 100)
    try:
        r = la.analyze(p)
        assert r["timed_out"] is True
    finally:
        p.unlink(missing_ok=True)


# ── line cap ──────────────────────────────────────────────────────────────────

def test_line_cap(monkeypatch, agents_file):
    monkeypatch.setenv("LOG_MAX_LINES", "1")
    import importlib

    import collector.api.log_analyzer as la
    importlib.reload(la)

    p = _write_tmp(SAMPLE_COMBINED)
    try:
        r = la.analyze(p)
        assert r["total_lines"] <= 2  # at most 1 real + 1 counted before break
    finally:
        p.unlink(missing_ok=True)


# ── cost estimation ───────────────────────────────────────────────────────────

def test_cost_estimation(agents_file):
    p = _write_tmp(SAMPLE_CF_CSV, suffix=".csv")
    try:
        from collector.api.log_analyzer import analyze
        r = analyze(p, cost_per_gb=0.09)
        assert r["estimated_bot_cost_usd"] >= 0
        assert r["cost_per_gb"] == 0.09
    finally:
        p.unlink(missing_ok=True)


# ── top pages ─────────────────────────────────────────────────────────────────

def test_top_pages_sorted_by_bot_hits(agents_file):
    p = _write_tmp(SAMPLE_CF_CSV, suffix=".csv")
    try:
        from collector.api.log_analyzer import analyze
        r = analyze(p)
        pages = r["top_pages"]
        assert len(pages) <= 20
        # first page should have >= bot_hits of subsequent pages
        if len(pages) > 1:
            assert pages[0]["bot_hits"] >= pages[-1]["bot_hits"]
    finally:
        p.unlink(missing_ok=True)
