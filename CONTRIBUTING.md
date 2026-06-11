# Contributing to TrueTraffic

Thank you for helping make the web more legible!

## Adding crawlers to `data/ai-agents.json`

This is the most valuable contribution. If you know of an AI crawler not yet listed:

1. Open an issue or PR.
2. Provide: crawler name, vendor, the exact `User-agent:` token used in robots.txt, a link to the vendor's documentation (if any), and the category (`training` / `search` / `browsing` / `scraping`).
3. We require a public source for each entry — no speculation.

## Code contributions

- Python 3.11+, type hints throughout, `ruff` for linting.
- Every new classification rule needs a unit test in `checker/tests/` **and** one line in `docs/methodology.md`.
- Run `ruff check . && pytest` before opening a PR. CI will enforce both.
- Keep the snippet (`snippet/hs.js`) under 5 KB gzipped with no runtime deps.

## Tone / copy

If you change any UI text, keep to: "suspected", "estimated", "evidence".
Do not use: "fraud", "guaranteed", "blocked", "detected".

## Good first issues

- Add a new crawler entry to `data/ai-agents.json`
- Add a missing IP range for an existing crawler
- Improve the `scripts/update_agents.py` sync script
- Translate the checker UI
