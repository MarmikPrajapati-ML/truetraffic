"""Unit tests for every classification rule — each maps to docs/methodology.md §Phase 2."""
from collector.api.classifier import classify


# R1 — webdriver flag
def test_R1_webdriver_is_agent():
    assert classify({"webdriver": True}) == "suspected_agent"


# R2 — headless UA
def test_R2_headless_ua_is_agent():
    assert classify({"headless_ua": True}) == "suspected_agent"


# R6 — instant full-depth scroll (≥3 weak signals when combined with R3+R4)
def test_R6_instant_full_scroll_with_weak_signals_is_agent():
    assert classify({
        "time_to_first_scroll_ms": 100,
        "scroll_depth_pct": 100,
        "languages_empty": True,
        "plugins_empty": True,
    }) == "suspected_agent"


# R7 — pointer activity → human
def test_R7_pointer_is_human():
    assert classify({"had_pointer": True}) == "human"


def test_R7_pointer_with_one_weak_signal_still_human():
    assert classify({"had_pointer": True, "plugins_empty": True}) == "human"


# Ambiguous → unknown
def test_no_signals_is_unknown():
    assert classify({}) == "unknown"


def test_single_weak_signal_is_unknown():
    assert classify({"languages_empty": True}) == "unknown"


def test_two_weak_signals_is_unknown():
    assert classify({"languages_empty": True, "plugins_empty": True}) == "unknown"


# Pointer with too many weak signals → unknown (conservative)
def test_pointer_with_multiple_weak_signals_is_unknown():
    assert classify({
        "had_pointer": True,
        "languages_empty": True,
        "plugins_empty": True,
        "screen_viewport_ratio_ok": False,
    }) == "unknown"


# Slow full-depth scroll is NOT suspicious on its own (R6 requires <500ms)
def test_slow_full_scroll_not_agent():
    result = classify({"time_to_first_scroll_ms": 3000, "scroll_depth_pct": 100})
    assert result != "suspected_agent"
