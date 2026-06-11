"""Rules-based session classifier — conservative: ambiguous → unknown, never agent."""
from __future__ import annotations

from typing import Literal

Classification = Literal["human", "suspected_agent", "unknown"]


def classify(signals: dict) -> Classification:
    """
    Classify a beacon payload as human / suspected_agent / unknown.

    Rule ordering: strong agent signals first, then compound weak signals,
    then positive human signals, else unknown.
    Every rule is documented in docs/methodology.md §Phase 2.
    """
    # R1 — navigator.webdriver=true is a reliable automation marker
    if signals.get("webdriver"):
        return "suspected_agent"

    # R2 — "headless" substring in User-Agent string (Chromium headless pattern)
    if signals.get("headless_ua"):
        return "suspected_agent"

    # Accumulate weak agent signals
    weak = 0

    # R3 — navigator.languages is empty (headless browsers often omit it)
    if signals.get("languages_empty"):
        weak += 1

    # R4 — navigator.plugins is empty (headless Chrome has no plugins)
    if signals.get("plugins_empty"):
        weak += 1

    # R5 — screen resolution doesn't contain viewport (impossible on real devices)
    if not signals.get("screen_viewport_ratio_ok", True):
        weak += 1

    # R6 — instant full-depth scroll (programmatic bots render then scroll to bottom)
    tts = signals.get("time_to_first_scroll_ms")
    depth = signals.get("scroll_depth_pct", 0)
    if tts is not None and tts < 500 and depth >= 90:
        weak += 2

    # R7 — real pointer activity is checked before compound threshold.
    # Pointer is strong positive evidence; it overrides weak compound signals.
    if signals.get("had_pointer"):
        if weak <= 1:
            return "human"
        # Pointer present but many weak signals: too ambiguous — stay conservative.
        return "unknown"

    # R6 compound threshold — only applies when no pointer activity was observed.
    if weak >= 3:
        return "suspected_agent"

    return "unknown"
