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

## Phase 2 — JS Snippet (planned)

See [snippet/](../snippet/) — not yet released. Classification will be rules-based v1,
documented here when shipped.

Conservative threshold policy: ambiguous sessions are classified `unknown`, never `agent`.
We will prefer false negatives (missing agents) over false positives (mislabelling humans).

---

## Limitations

- robots.txt is **advisory**. A crawler may ignore it; we cannot verify compliance.
- Our crawler list (`data/ai-agents.json`) is community-maintained and may be incomplete.
- `not_mentioned` does not mean the crawler is definitely crawling your site — only that
  your robots.txt has not explicitly addressed it.
- All language in the product uses "suspected", "estimated", "evidence". Never "detected",
  "guaranteed", or "blocked" (the last implies enforcement, which robots.txt cannot provide).
