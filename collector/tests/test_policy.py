"""Phase 4 tests — policy generator."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

AGENTS = [
    {"name": "GPTBot", "vendor": "OpenAI", "robots_txt_token": "GPTBot",
     "user_agent_pattern": "GPTBot", "declared": True, "category": "training"},
    {"name": "ClaudeBot", "vendor": "Anthropic", "robots_txt_token": "ClaudeBot",
     "user_agent_pattern": "ClaudeBot", "declared": True, "category": "search"},
    {"name": "PerplexityBot", "vendor": "Perplexity", "robots_txt_token": "PerplexityBot",
     "user_agent_pattern": "PerplexityBot", "declared": True, "category": "browsing"},
]


@pytest.fixture()
def agents_file(tmp_path, monkeypatch) -> Path:
    p = tmp_path / "ai-agents.json"
    p.write_text(json.dumps(AGENTS))
    monkeypatch.setenv("AGENTS_PATH", str(p))
    import importlib

    import collector.api.policy as pol
    importlib.reload(pol)
    return p


def test_prefill_block_detection(agents_file):
    robots_txt = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n"
    from collector.api.policy import prefill_from_robots
    decisions = prefill_from_robots(robots_txt)
    assert decisions["GPTBot"] == "block"
    assert decisions["ClaudeBot"] == "inherit"


def test_prefill_allow_detection(agents_file):
    robots_txt = "User-agent: ClaudeBot\nAllow: /\n"
    from collector.api.policy import prefill_from_robots
    decisions = prefill_from_robots(robots_txt)
    assert decisions["ClaudeBot"] == "allow"


def test_prefill_inherit_when_not_mentioned(agents_file):
    from collector.api.policy import prefill_from_robots
    decisions = prefill_from_robots("")
    for name in [a["name"] for a in AGENTS]:
        assert decisions[name] == "inherit"


def test_generate_block_entry(agents_file):
    from collector.api.policy import generate_robots_block
    block = generate_robots_block({"GPTBot": "block", "ClaudeBot": "inherit"})
    assert "User-agent: GPTBot" in block
    assert "Disallow: /" in block
    assert "ClaudeBot" not in block


def test_generate_allow_entry(agents_file):
    from collector.api.policy import generate_robots_block
    block = generate_robots_block({"GPTBot": "allow"})
    assert "User-agent: GPTBot" in block
    assert "Allow: /" in block
    assert "Disallow" not in block


def test_generate_skip_inherit(agents_file):
    from collector.api.policy import generate_robots_block
    block = generate_robots_block({"GPTBot": "inherit", "ClaudeBot": "inherit"})
    assert "GPTBot" not in block
    assert "ClaudeBot" not in block


def test_generate_llms_txt_contains_domain(agents_file):
    from collector.api.policy import generate_llms_txt
    txt = generate_llms_txt("example.com", {"GPTBot": "block"})
    assert "example.com" in txt
    assert "GPTBot" in txt


def test_generate_llms_txt_blocked_listed(agents_file):
    from collector.api.policy import generate_llms_txt
    txt = generate_llms_txt("example.com", {"GPTBot": "block", "ClaudeBot": "allow"})
    assert "GPTBot" in txt
    assert "ClaudeBot" in txt


def test_get_agents_by_category(agents_file):
    from collector.api.policy import get_agents_by_category
    groups = get_agents_by_category()
    assert "training" in groups
    assert "search" in groups
    assert "browsing" in groups
    assert any(a["name"] == "GPTBot" for a in groups["training"])


def test_generate_robots_block_has_header(agents_file):
    from collector.api.policy import generate_robots_block
    block = generate_robots_block({"GPTBot": "block"})
    assert "TrueTraffic" in block
