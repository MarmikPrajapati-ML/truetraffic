"""Phase 4 — Crawler Watch: sync upstream agent list, diff, notify subscribers."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Callable

import httpx

from shared.email import send_email

_log = logging.getLogger(__name__)

_AI_ROBOTS_URL = (
    "https://raw.githubusercontent.com/ai-robots-txt/ai.robots.txt/main/robots.txt"
)

_UNSUBSCRIBE_BASE = "http://localhost:8001"


def fetch_upstream_tokens(fetch_fn: Callable[[str], str] | None = None) -> list[str]:
    """Fetch agent token list from the upstream ai-robots-txt project."""
    def _default_fetch(url: str) -> str:
        r = httpx.get(url, timeout=15, follow_redirects=True)
        r.raise_for_status()
        return r.text

    get = fetch_fn or _default_fetch
    text = get(_AI_ROBOTS_URL)
    tokens: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("user-agent:"):
            token = stripped[len("user-agent:"):].strip()
            if token and token != "*":
                tokens.append(token)
    return list(dict.fromkeys(tokens))


def do_sync(
    db,
    fetch_fn: Callable[[str], str] | None = None,
    base_url: str | None = None,
) -> dict:
    """
    Idempotent daily sync:
    1. Fetch upstream tokens.
    2. Compare with latest DB snapshot.
    3. If diff → save changelog + notify subscribers.
    4. Always save new snapshot (or skip if identical to today's).
    Returns summary dict.
    """
    from .models import CrawlerChangelog, CrawlerSnapshot, Subscriber

    upstream = set(fetch_upstream_tokens(fetch_fn))
    today = date.today().isoformat()

    last = (
        db.query(CrawlerSnapshot)
        .order_by(CrawlerSnapshot.snapshot_date.desc())
        .first()
    )
    previous: set[str] = set(json.loads(last.agent_names_json)) if last else set()

    added = sorted(upstream - previous)
    removed = sorted(previous - upstream)

    # Only diff and notify when transitioning from a known prior state.
    # First-ever sync initializes the baseline without triggering alerts.
    if (added or removed) and last is not None:
        changelog = CrawlerChangelog(
            changed_at=datetime.utcnow(),
            added_json=json.dumps(added),
            removed_json=json.dumps(removed),
        )
        db.add(changelog)
        _log.info("crawler_diff added=%s removed=%s", added, removed)

        if added:
            subscribers = db.query(Subscriber).all()
            base = base_url or _UNSUBSCRIBE_BASE
            for sub in subscribers:
                _notify_subscriber(sub, added, base)

    if last is None:
        added, removed = [], []

    existing_today = (
        db.query(CrawlerSnapshot)
        .filter(CrawlerSnapshot.snapshot_date == today)
        .first()
    )
    if existing_today:
        existing_today.agent_names_json = json.dumps(sorted(upstream))
    else:
        db.add(CrawlerSnapshot(snapshot_date=today, agent_names_json=json.dumps(sorted(upstream))))

    db.commit()
    return {"added": added, "removed": removed, "total": len(upstream)}


def _notify_subscriber(sub, added_agents: list[str], base_url: str) -> None:
    def _safe(name: str) -> str:
        return name.replace("\r", "").replace("\n", "")

    names = "\n".join(f"  • {_safe(n)}" for n in added_agents)
    unsub = f"{base_url}/crawlerwatch/unsubscribe/{sub.unsubscribe_token}"
    body = (
        f"TrueTraffic Crawler Watch\n\n"
        f"New AI crawler(s) detected:\n{names}\n\n"
        f"Update your robots.txt at: {base_url}\n\n"
        f"Unsubscribe (one click): {unsub}\n"
    )
    try:
        send_email(sub.email, "New AI crawler detected — TrueTraffic", body)
    except Exception as exc:
        _log.warning("email_failed to=%s err=%s", sub.email, exc)
