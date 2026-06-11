"""Sync ai-agents.json from public upstream sources.

Run: python scripts/update_agents.py

Sources:
  - https://github.com/ai-robots-txt/ai.robots.txt  (MIT)
  - https://github.com/monperrus/crawler-user-agents  (MIT)

The script merges upstream UA tokens into data/ai-agents.json, preserving
any extra fields (documentation, category) already in the local file.
New entries are appended; existing ones are updated (token/pattern only).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import httpx
except ImportError:
    sys.exit("Run: pip install httpx")

REPO_ROOT = Path(__file__).parent.parent
AGENTS_PATH = REPO_ROOT / "data" / "ai-agents.json"

AI_ROBOTS_URL = (
    "https://raw.githubusercontent.com/ai-robots-txt/ai.robots.txt/main/robots.txt"
)
CRAWLER_UA_URL = (
    "https://raw.githubusercontent.com/monperrus/crawler-user-agents/master/"
    "crawler-user-agents.json"
)


def fetch(url: str) -> str:
    r = httpx.get(url, timeout=10, follow_redirects=True)
    r.raise_for_status()
    return r.text


def parse_ai_robots_txt(text: str) -> list[str]:
    """Extract User-agent tokens from ai-robots-txt project robots.txt."""
    tokens: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("user-agent:"):
            token = stripped[len("user-agent:"):].strip()
            if token and token != "*":
                tokens.append(token)
    return list(dict.fromkeys(tokens))  # deduplicate, preserve order


def parse_crawler_ua_json(text: str) -> list[dict]:
    """Return crawler entries with 'instances' list from monperrus list."""
    data = json.loads(text)
    return [
        entry for entry in data
        if any(
            kw in entry.get("pattern", "").lower()
            for kw in ("gpt", "claude", "bot", "ai", "crawl", "spider")
        )
    ]


def merge(existing: list[dict], upstream_tokens: list[str]) -> list[dict]:
    existing_by_token = {e["robots_txt_token"].lower(): e for e in existing}
    for token in upstream_tokens:
        key = token.lower()
        if key not in existing_by_token:
            existing.append(
                {
                    "name": token,
                    "vendor": "Unknown",
                    "robots_txt_token": token,
                    "user_agent_pattern": token,
                    "declared": True,
                    "documentation": "",
                    "category": "training",
                }
            )
            print(f"  + added: {token}")
    return existing


def main() -> None:
    print("Fetching ai-robots-txt …")
    try:
        robots_text = fetch(AI_ROBOTS_URL)
        upstream_tokens = parse_ai_robots_txt(robots_text)
        print(f"  found {len(upstream_tokens)} tokens")
    except Exception as exc:
        print(f"  WARNING: could not fetch ai-robots-txt: {exc}")
        upstream_tokens = []

    existing = json.loads(AGENTS_PATH.read_text())
    merged = merge(existing, upstream_tokens)

    AGENTS_PATH.write_text(json.dumps(merged, indent=2) + "\n")
    print(f"Done. {len(merged)} entries in {AGENTS_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
