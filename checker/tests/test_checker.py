"""Unit tests for the checker module."""

from checker.api.checker import (
    _build_robots_block,
    _check_crawler_in_robots,
    _grade,
    _is_explicitly_mentioned,
)

# --- _grade ---

def test_grade_all_blocked():
    assert _grade(0, 17) == "A"


def test_grade_none_blocked():
    assert _grade(17, 17) == "F"


def test_grade_quartiles():
    assert _grade(5, 20) == "B"   # 25 %
    assert _grade(10, 20) == "C"  # 50 %
    assert _grade(15, 20) == "D"  # 75 %


def test_grade_zero_total():
    assert _grade(0, 0) == "N/A"


# --- _is_explicitly_mentioned ---

def test_mentioned_exact():
    assert _is_explicitly_mentioned("User-agent: GPTBot\nDisallow: /", "GPTBot")


def test_mentioned_case_insensitive():
    assert _is_explicitly_mentioned("user-agent: gptbot\nDisallow: /", "GPTBot")


def test_not_mentioned():
    assert not _is_explicitly_mentioned("User-agent: Googlebot\nDisallow: /", "GPTBot")


# --- _check_crawler_in_robots ---

DISALLOW_GPTBOT = "User-agent: GPTBot\nDisallow: /"
ALLOW_GPTBOT = "User-agent: GPTBot\nAllow: /"
WILDCARD_DISALLOW = "User-agent: *\nDisallow: /"
WILDCARD_ALLOW = "User-agent: *\nAllow: /"
OTHER_ONLY = "User-agent: Googlebot\nDisallow: /private/"


def test_explicitly_disallowed():
    assert _check_crawler_in_robots(DISALLOW_GPTBOT, "GPTBot") == "disallowed"


def test_explicitly_allowed():
    assert _check_crawler_in_robots(ALLOW_GPTBOT, "GPTBot") == "allowed"


def test_not_mentioned_open_wildcard():
    assert _check_crawler_in_robots(OTHER_ONLY, "GPTBot") == "not_mentioned"


def test_wildcard_disallow_applies_to_unlisted():
    assert _check_crawler_in_robots(WILDCARD_DISALLOW, "GPTBot") == "disallowed"


def test_wildcard_allow_means_not_mentioned():
    assert _check_crawler_in_robots(WILDCARD_ALLOW, "GPTBot") == "not_mentioned"


def test_no_robots_txt():
    assert _check_crawler_in_robots(None, "GPTBot") == "not_mentioned"


def test_empty_robots_txt():
    assert _check_crawler_in_robots("", "GPTBot") == "not_mentioned"


def test_explicit_overrides_wildcard():
    robots = "User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /"
    assert _check_crawler_in_robots(robots, "GPTBot") == "allowed"


# --- _build_robots_block ---

def test_build_block_contains_agents():
    block = _build_robots_block(["GPTBot", "ClaudeBot"])
    assert "User-agent: GPTBot" in block
    assert "User-agent: ClaudeBot" in block
    assert "Disallow: /" in block


def test_build_block_empty():
    assert _build_robots_block([]) == ""
