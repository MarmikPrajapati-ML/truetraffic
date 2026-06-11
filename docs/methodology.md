# TrueTraffic — Classification Methodology

This document describes every rule used to classify traffic or assess AI crawler exposure.
It is intentionally public so that anyone can audit, challenge, or improve our reasoning.

---

## Phase 1 — Domain Checker (robots.txt analysis)

### What we measure

The checker fetches `https://{domain}/robots.txt` and `https://{domain}/llms.txt` from
our server (to avoid CORS) and parses the robots.txt against a curated list of known AI
crawler `User-agent` tokens (`data/ai-agents.json`).

### Per-crawler status

For each AI crawler we assign one of three statuses:

| Status | Meaning |
|---|---|
| `disallowed` | The crawler is explicitly listed with a `Disallow: /` rule, **or** a wildcard `User-agent: *` with `Disallow: /` applies and the crawler is not explicitly mentioned. |
| `allowed` | The crawler is explicitly listed with an `Allow: /` rule that permits access. |
| `not_mentioned` | The crawler is not listed at all and no wildcard blocks it. Per the robots.txt spec this means the crawler **may** access the site — we flag this explicitly so owners know they never addressed this bot. |

**Rule 1** — Explicit entry overrides wildcard.
If a crawler has its own `User-agent:` block, that block's rules apply exclusively; the
wildcard block is ignored for that crawler (robots.txt spec §2.2.2).

**Rule 2** — Wildcard block catches unlisted crawlers.
If `User-agent: *` contains `Disallow: /` and a crawler is not explicitly mentioned, the
crawler is classified as `disallowed`.

**Rule 3** — Missing robots.txt = not_mentioned.
If the domain returns any non-200 status for `/robots.txt` we treat every crawler as
`not_mentioned` (accessible by default). We do not penalise the grade for a missing file
beyond the `not_mentioned` designation.

### Grade

The grade reflects estimated AI crawler exposure, not a quality judgement about whether
exposure is good or bad (some publishers *want* AI crawlers to index their content).

| Grade | Condition |
|---|---|
| A | 0 crawlers have open access |
| B | 1–25 % of crawlers have open access |
| C | 26–50 % |
| D | 51–75 % |
| F | 76–100 % |

"Open access" = `allowed` + `not_mentioned`.

### What we do NOT measure in Phase 1

- Disguised agentic browsers that execute JavaScript (see Phase 2).
- IP-based blocking (Cloudflare WAF rules, .htaccess, etc.).
- Rate limiting or CAPTCHA walls.
- Any inference about the owner's intent.

---

## Phase 2 — JS Snippet (live, v0.2)

`snippet/hs.js` is injected into `<head>` via the embed snippet or WordPress plugin.
It collects 13 anonymous behavioural signals and sends them via `navigator.sendBeacon()`
on page leave. No cookies, no PII, no blocking of page render.

### Conservative threshold policy

Ambiguous sessions are classified `unknown`, never `agent`.
We prefer false negatives (missing bots) over false positives (mislabelling humans).

### Classification rules (ordered by confidence)

```
R1: webdriver = true          → suspected_agent   (CDP automation flag)
R2: headless_ua = true        → suspected_agent   ("headless" in UA string)

Accumulate weak score:
  +1  languages_empty                            (R3)
  +1  plugins_empty                              (R4)
  +1  screen_viewport_ratio_ok = false           (R5)
  +2  time_to_first_scroll_ms < 500ms
      AND scroll_depth_pct >= 90%                (R6 — instant full scroll)

R7: had_pointer = true
    → human         (weak ≤ 1)
    → unknown       (weak ≥ 2, too ambiguous)

No pointer: weak ≥ 3          → suspected_agent
No pointer: weak < 3          → unknown
```

For full signal descriptions see [FEATURES.md § JS Snippet Reference](FEATURES.md#11-js-snippet-reference).

---

## Phase 3 — Server Log Analysis (live)

Streaming parser in `collector/api/log_analyzer.py` supports nginx/Apache combined log
format and Cloudflare CSV exports. Format is auto-detected from the first line.

User-Agent matching: case-insensitive substring search against each crawler's
`user_agent_pattern` from `data/ai-agents.json`.

AI referral detection: Referer header checked for `chat.openai.com`, `claude.ai`,
`perplexity.ai`, `you.com`.

---

## Phase 4 — Policy Generation + Crawler Watch (live)

**Policy generation:** Per-crawler decisions (block/allow/inherit) map to robots.txt
`User-agent:` blocks. `inherit` means the crawler is omitted and follows wildcard rules.

**Crawler Watch:** Daily sync from the ai-robots-txt community project. Diffs new vs.
previous snapshot and emails subscribers. First sync initialises baseline without alerts.

---

## Limitations (all phases)

- robots.txt is **advisory**. A crawler may ignore it; we cannot verify compliance.
- Our crawler list (`data/ai-agents.json`) is community-maintained and may be incomplete.
- `not_mentioned` does not mean the crawler is definitely crawling your site — only that
  your robots.txt has not explicitly addressed it.
- The JS classifier cannot detect bots that skip JavaScript execution (declared crawlers).
- Sophisticated bots suppressing all detectable signals will be classified as `unknown`.
- All product language uses "suspected", "estimated", "evidence". Never "detected",
  "guaranteed", or "blocked" (robots.txt cannot technically enforce access control).
