"""Phase 3 — streaming log analyzer. Supports nginx/Apache combined + Cloudflare CSV.

H1: streams line-by-line, never reads whole file into memory.
H8: caller must delete the temp file after this returns.
"""
from __future__ import annotations

import csv
import json
import os
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import apache_log_parser

_AGENTS_PATH = Path(
    os.environ.get(
        "AGENTS_PATH",
        str(Path(__file__).parent.parent.parent / "data" / "ai-agents.json"),
    )
)

MAX_LINES: int = int(os.environ.get("LOG_MAX_LINES", 10_000_000))
WALL_TIMEOUT: float = float(os.environ.get("LOG_PARSE_TIMEOUT", 120.0))

_COMBINED_PARSER = apache_log_parser.make_parser(
    '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"'
)

_CLOUDFLARE_UA_FIELDS = ("ClientRequestUserAgent",)
_CLOUDFLARE_DETECT_HEADERS = ("ClientRequestUserAgent", "ClientIP")

_AI_REFERRER_DOMAINS = (
    "chat.openai.com", "perplexity.ai", "claude.ai", "bard.google.com",
)


@dataclass
class _Row:
    ip: str = ""
    ua: str = ""
    path: str = ""
    bytes_sent: int = 0
    status: int = 0
    date: str = ""


def detect_format(first_line: str) -> str:
    if any(h in first_line for h in _CLOUDFLARE_DETECT_HEADERS):
        return "cloudflare_csv"
    return "combined"


def _iter_combined(fh) -> Iterator[_Row | None]:
    for raw in fh:
        try:
            d = _COMBINED_PARSER(raw.strip())
            yield _Row(
                ip=d.get("remote_host", ""),
                ua=d.get("request_header_user_agent", ""),
                path=d.get("request_url", ""),
                bytes_sent=int(d.get("response_bytes_clf", 0) or 0),
                status=int(d.get("status", 0) or 0),
                date=str(d.get("time_received_isoformat", ""))[:10],
            )
        except Exception:
            yield None


def _iter_cloudflare(fh) -> Iterator[_Row | None]:
    reader = csv.DictReader(fh)
    headers: list[str] = list(reader.fieldnames or [])
    ua_col = next((h for h in headers if h in _CLOUDFLARE_UA_FIELDS), None)
    ip_col = next((h for h in headers if h == "ClientIP"), None)
    path_col = next((h for h in headers if h == "ClientRequestURI"), None)
    bytes_col = next(
        (h for h in headers if h in ("EdgeResponseBytes", "ClientRequestBytes")), None
    )
    status_col = next((h for h in headers if h == "EdgeResponseStatus"), None)
    ts_col = next((h for h in headers if h == "EdgeStartTimestamp"), None)

    for row in reader:
        try:
            yield _Row(
                ip=row.get(ip_col or "", ""),
                ua=row.get(ua_col or "", ""),
                path=row.get(path_col or "", ""),
                bytes_sent=int(row.get(bytes_col or "", 0) or 0),
                status=int(row.get(status_col or "", 0) or 0),
                date=str(row.get(ts_col or "", ""))[:10],
            )
        except Exception:
            yield None


def analyze(
    path: Path,
    fmt: str = "auto",
    cost_per_gb: float = 0.09,
) -> dict:
    """
    Stream-parse the log file at `path` and return an aggregate report dict.
    Caller must delete `path` after this returns (H8).
    """
    agents: list[dict] = json.loads(_AGENTS_PATH.read_text())
    ua_index: dict[str, str] = {
        a["user_agent_pattern"].lower(): a["name"] for a in agents
    }
    agent_meta: dict[str, dict] = {a["name"]: a for a in agents}

    total_lines = 0
    malformed = 0
    total_requests = 0
    bot_hits: dict[str, int] = defaultdict(int)
    bot_bytes_map: dict[str, int] = defaultdict(int)
    page_hits: dict[str, int] = defaultdict(int)
    page_bot_hits: dict[str, int] = defaultdict(int)
    daily: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "bot": 0})
    total_bytes = 0
    bot_total_bytes = 0
    ai_referrals = 0

    deadline = time.monotonic() + WALL_TIMEOUT
    timed_out = False

    with path.open("r", encoding="utf-8", errors="replace") as fh:
        first_line = fh.readline()
        detected_fmt = detect_format(first_line) if fmt == "auto" else fmt
        fh.seek(0)

        row_iter = _iter_cloudflare(fh) if detected_fmt == "cloudflare_csv" else _iter_combined(fh)

        for row in row_iter:
            if time.monotonic() > deadline:
                timed_out = True
                break
            total_lines += 1
            if total_lines > MAX_LINES:
                break

            if row is None:
                malformed += 1
                continue

            total_requests += 1
            total_bytes += row.bytes_sent
            path_trunc = row.path[:200]
            day = row.date or "unknown"
            page_hits[path_trunc] += 1
            daily[day]["total"] += 1

            ua_lower = row.ua.lower()
            bot_name: str | None = None
            for pattern, name in ua_index.items():
                if pattern in ua_lower:
                    bot_name = name
                    break

            if bot_name:
                bot_hits[bot_name] += 1
                bot_bytes_map[bot_name] += row.bytes_sent
                page_bot_hits[path_trunc] += 1
                daily[day]["bot"] += 1
                bot_total_bytes += row.bytes_sent

            if any(d in ua_lower for d in _AI_REFERRER_DOMAINS):
                ai_referrals += 1

    bot_requests = sum(bot_hits.values())
    gb_billed = bot_total_bytes / 1_073_741_824
    cost_usd = round(gb_billed * cost_per_gb, 4)

    top_pages = sorted(
        page_hits.items(),
        key=lambda x: page_bot_hits.get(x[0], 0),
        reverse=True,
    )[:20]

    return {
        "format_detected": detected_fmt,
        "total_lines": total_lines,
        "malformed_lines": malformed,
        "total_requests": total_requests,
        "bot_requests": bot_requests,
        "human_requests": total_requests - bot_requests,
        "bot_pct": round(bot_requests / total_requests * 100, 2) if total_requests else 0,
        "total_bytes": total_bytes,
        "bot_bytes": bot_total_bytes,
        "cost_per_gb": cost_per_gb,
        "estimated_bot_cost_usd": cost_usd,
        "ai_referral_hits": ai_referrals,
        "bot_breakdown": [
            {
                "name": name,
                "vendor": agent_meta.get(name, {}).get("vendor", "Unknown"),
                "category": agent_meta.get(name, {}).get("category", "unknown"),
                "hits": hits,
                "bytes": bot_bytes_map.get(name, 0),
            }
            for name, hits in sorted(bot_hits.items(), key=lambda x: -x[1])
        ],
        "top_pages": [
            {
                "path": p,
                "total_hits": page_hits[p],
                "bot_hits": page_bot_hits.get(p, 0),
                "bot_ratio": round(page_bot_hits.get(p, 0) / page_hits[p], 3),
            }
            for p, _ in top_pages
        ],
        "daily_trend": dict(sorted(daily.items())),
        "timed_out": timed_out,
    }
