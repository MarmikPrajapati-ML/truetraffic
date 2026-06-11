# TrueTraffic — How It Works

Technical deep dive into every algorithm, logic layer, accuracy consideration, and data flow. Intended for developers integrating TrueTraffic, researchers auditing the methodology, and advanced users who want to understand the numbers.

---

## Architecture: Two Detection Layers

TrueTraffic uses two fundamentally different techniques because no single technique catches all bots.

```
┌──────────────────────────────────────────────────────────┐
│                  Bot Population                          │
│                                                          │
│  ┌─────────────────────┐   ┌──────────────────────────┐ │
│  │  Declared Crawlers  │   │  Disguised Agents        │ │
│  │  (no JS execution)  │   │  (execute JS in browser) │ │
│  │                     │   │                          │ │
│  │  GPTBot, ClaudeBot, │   │  Playwright, Puppeteer,  │ │
│  │  Bytespider, etc.   │   │  CDP-based AI agents     │ │
│  └──────────┬──────────┘   └────────────┬─────────────┘ │
│             │                           │               │
└─────────────┼───────────────────────────┼───────────────┘
              │                           │
              ▼                           ▼
   ┌──────────────────┐       ┌───────────────────────┐
   │  Layer 1         │       │  Layer 2              │
   │  Checker API     │       │  JS Snippet           │
   │  (robots.txt)    │       │  + Classifier         │
   │                  │       │                       │
   │  Also:           │       │  Also:                │
   │  Log Analyzer    │       │  Server logs (partial)│
   │  (User-Agent)    │       │                       │
   └──────────────────┘       └───────────────────────┘
```

Neither layer is sufficient alone. The combination provides the fullest picture available without server-side WAF integration.

---

## Layer 1: Robots.txt Analysis (Checker API)

### How the checker fetches data

The checker API (`checker/api/checker.py`) performs the following steps when you enter a domain:

1. **SSRF-safe DNS resolution** — the domain is resolved to an IP address. The IP is checked against a blocklist of private/reserved ranges (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, etc.) to prevent server-side request forgery attacks. Only public IP addresses are allowed.

2. **Robots.txt fetch** — `GET https://{domain}/robots.txt` (falls back to `http://` if HTTPS fails). Maximum response size: 1 MB. Timeout: 10 seconds.

3. **llms.txt fetch** — `GET https://{domain}/llms.txt`. Same constraints. Used only to show the "llms.txt found" pill — not used in grading.

4. **Per-crawler status classification** — for each of the 20 known AI crawlers, the checker determines one of three statuses.

### Per-crawler status logic

The status for each crawler is determined by `_check_crawler_in_robots()`:

```
if robots.txt is None (fetch failed or non-200):
    → not_mentioned  (no information available)

if crawler token is explicitly listed (own User-agent block):
    use urllib.robotparser to check can_fetch(token, "/")
    → "allowed"    if can_fetch = True
    → "disallowed" if can_fetch = False

if crawler is NOT explicitly listed:
    use urllib.robotparser to check under wildcard rules
    if wildcard blocks access (User-agent: * with Disallow: /):
        → "disallowed"  (wildcard catches unlisted crawlers)
    else:
        → "not_mentioned"  (no rule addresses this crawler)
```

**robots.txt spec compliance:** Explicit User-agent blocks take precedence over wildcard blocks (RFC 9309 §2.2.2). A crawler with its own block is evaluated only against that block, not the wildcard.

### Grading algorithm

The grade is computed from the fraction of crawlers with "open access":

```
open_count = count(status == "allowed") + count(status == "not_mentioned")
ratio = open_count / total_crawlers

ratio == 0.0          → A  (fully protected)
0.0 < ratio <= 0.25   → B  (mostly protected)
0.25 < ratio <= 0.50  → C  (partially open)
0.50 < ratio <= 0.75  → D  (mostly open)
ratio > 0.75          → F  (fully open)
```

**Design choice:** `not_mentioned` counts as "open", not "unknown". This is intentional — if you have not explicitly addressed a crawler, it has open access by default (robots.txt is permissive by default). Not mentioning GPTBot is equivalent to allowing it.

### Accuracy and limitations of Layer 1

**High confidence:**
- Correctly reflects what your robots.txt says about each known crawler
- Uses the same parser (`urllib.robotparser`) that well-behaved crawlers use
- Detects both explicit rules and wildcard-inherited rules

**Cannot detect:**
- Crawlers that ignore robots.txt entirely (policy compliance, not technical enforcement)
- Crawlers with User-Agent strings not in `data/ai-agents.json`
- IP-based blocking or WAF rules
- Rate limiting or authentication walls
- Whether the crawler is actually crawling your site (only whether it is allowed to)

**Known false negatives:**
- A new AI company that launched after the last `ai-agents.json` update will not appear
- Crawlers that change their User-Agent string without updating their documentation

---

## Layer 2: JavaScript Snippet + Classifier

### Signal collection (hs.js)

The snippet (`snippet/hs.js`) runs in the visitor's browser. It collects 13 boolean and numeric signals, then sends them as a single JSON payload via `navigator.sendBeacon()` when the user navigates away or closes the tab. It never blocks page render and fires exactly once per session.

#### Signals collected

| Signal | Type | What it measures |
|--------|------|-----------------|
| `webdriver` | Boolean | `navigator.webdriver === true` — the standard flag automation frameworks set |
| `headless_ua` | Boolean | Whether the User-Agent string contains "headless" (case-insensitive) |
| `languages_empty` | Boolean | `navigator.languages` is empty or missing |
| `plugins_empty` | Boolean | `navigator.plugins.length === 0` |
| `had_pointer` | Boolean | At least one mouse/touch event in the first 5 seconds |
| `pointer_count` | Integer | Number of pointer events in the first 5 seconds (capped at 10,000) |
| `scroll_depth_pct` | Integer 0–100 | How far down the page the visitor scrolled (100 = bottom) |
| `time_to_first_scroll_ms` | Float | Milliseconds between page load and first scroll event |
| `paint_to_interaction_ms` | Float | Milliseconds between First Contentful Paint and first pointer event |
| `viewport_w / viewport_h` | Integer | Browser window inner dimensions |
| `screen_w / screen_h` | Integer | Physical screen dimensions |
| `screen_viewport_ratio_ok` | Boolean | Screen dimensions ≥ viewport dimensions (impossible otherwise on real hardware) |

#### Why these signals?

Each signal targets a known behaviour of headless browsers and automation frameworks:

- **`webdriver`**: Chromium-based automation (Puppeteer, Playwright, CDP) sets `navigator.webdriver = true` unless explicitly suppressed. This is the strongest single signal.
- **`headless_ua`**: Some headless browsers include "HeadlessChrome" in their UA string — a clear marker.
- **`languages_empty`**: Headless Chrome launched without locale configuration has no language preferences. Real browsers always have at least one.
- **`plugins_empty`**: Headless Chrome has no browser plugins. Real desktop browsers typically have several (PDF viewer, etc.). Mobile browsers have zero but send other human signals.
- **`screen_viewport_ratio_ok`**: It is physically impossible for a browser window to be larger than the screen. Automated environments sometimes report viewport dimensions that exceed screen dimensions due to virtual display configuration.
- **`time_to_first_scroll_ms < 500ms with scroll_depth_pct >= 90%`**: A human cannot scroll to 90% of a page in under half a second. Programmatic bots render and then immediately `window.scrollTo(0, document.body.scrollHeight)`.
- **`had_pointer`**: Human browsing almost always involves mouse movement or touch events within the first 5 seconds of a page visit. Automated tools almost never do.

### Classifier logic

The server-side classifier (`collector/api/classifier.py`) applies rules in order of confidence:

```
INPUT: signals dict from beacon payload

RULE R1 (strong): webdriver = true
    → suspected_agent  (immediate, no further checks)

RULE R2 (strong): headless_ua = true
    → suspected_agent  (immediate, no further checks)

WEAK SIGNAL ACCUMULATION:
  weak_score = 0
  +1 if languages_empty = true  (R3)
  +1 if plugins_empty = true    (R4)
  +1 if screen_viewport_ratio_ok = false  (R5)
  +2 if time_to_first_scroll_ms < 500 AND scroll_depth_pct >= 90  (R6)

RULE R7 (positive human signal): had_pointer = true
    if weak_score <= 1: → human
        (pointer activity plus at most one weak signal = human)
    if weak_score >= 2: → unknown
        (pointer present but too many agent signals — too ambiguous)

COMPOUND THRESHOLD (no pointer activity):
    if weak_score >= 3: → suspected_agent
    else: → unknown
```

**Conservative design principle:** The classifier deliberately produces false negatives (missing some bots) rather than false positives (mislabelling humans as bots). An unknown result is always preferred over an incorrect result. This is why the "unknown" bucket can be substantial.

### Accuracy of Layer 2

**High confidence classifications:**

| Scenario | Classification | Confidence |
|----------|---------------|-----------|
| webdriver = true | suspected_agent | ~99% — very rarely set in real browsers |
| headless_ua = true | suspected_agent | ~99% — only headless Chrome in production |
| pointer + scroll + normal plugins | human | ~95%+ — mimicking all signals simultaneously is hard |
| all weak signals high, no pointer | suspected_agent | ~80% — compound signals are strong but not definitive |

**Low confidence classifications:**

| Scenario | Classification | Why uncertain |
|----------|---------------|--------------|
| Mobile browser, no pointer, no scroll | unknown | Mobile users may not scroll immediately; plugins_empty is normal |
| Bot that suppresses webdriver flag | unknown/missed | Sophisticated bots patch navigator.webdriver |
| Bot that simulates mouse events | unknown/human | Only verifiable with deeper timing analysis |

**What the snippet definitively cannot detect:**
- Bots that do not execute JavaScript (they never run the snippet at all)
- Bots that perfectly mimic human behaviour at the protocol level
- Headless browsers patched to remove all detectable signals (Puppeteer-stealth, etc.)

**What the snippet is reliable at:**
- Standard automation frameworks (Puppeteer, Playwright, Selenium) used by the majority of automated traffic
- Bots that do not go to the trouble of mimicking human behaviour (most AI training agents)
- Simple headless scrapers

### The "unknown" bucket

A substantial fraction of sessions will be classified as unknown. This is not a failure — it is by design. Unknown means "we cannot determine the nature of this session from the available signals." It includes:

- Sophisticated bots that mimic humans
- Mobile users who load a page and immediately leave without scrolling or touching
- Humans on unusual browser configurations (hardened privacy browsers, no-JS polyfills)
- Legitimate browser automation for accessibility tools

For most analysis purposes, treating unknown as "not confirmed human" is the conservative approach.

---

## Layer 3: Server Log Analysis (Log Analyzer)

### How the parser works

The log analyzer (`collector/api/log_analyzer.py`) streams log files line-by-line without loading the entire file into memory. This allows it to handle logs much larger than available RAM.

**Format auto-detection:**

The first non-empty line is read. If it contains "ClientRequestUserAgent" or "ClientIP" (Cloudflare CSV headers), the Cloudflare parser is used. Otherwise, the nginx/Apache combined log parser is used.

**User-Agent matching:**

Each request's User-Agent string is checked against `data/ai-agents.json`. The match checks whether the crawler's `user_agent_pattern` appears as a substring of the UA string (case-insensitive). This means:
- `GPTBot/1.0` matches the pattern `GPTBot`
- `Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)` also matches

**AI referral detection:**

The Referer header is checked for known AI platform domains:
- `chat.openai.com` — ChatGPT conversation referrals
- `claude.ai` — Claude conversation referrals
- `perplexity.ai` — Perplexity search referrals
- `you.com` — You.com search referrals
- `bing.com` (when including "copilot") — Copilot referrals

These indicate organic traffic driven by AI (someone pasting your URL into a chat), not bot crawling.

**Bandwidth cost calculation:**

```
estimated_cost_usd = (total_bot_bytes / 1_073_741_824) × cost_per_gb
```

Default `cost_per_gb` = $0.09 (AWS CloudFront rate). This is configurable per analysis. The cost represents what you are paying in CDN/egress fees to serve AI crawlers.

**Performance limits:**

| Limit | Value | Why |
|-------|-------|-----|
| Max file size | 100 MB | Configurable via `LOG_MAX_UPLOAD_BYTES` |
| Max lines | 10,000,000 | Configurable via `LOG_MAX_LINES` |
| Wall-clock timeout | 120 seconds | Configurable via `LOG_PARSE_TIMEOUT` |

If the timeout is hit, parsing stops and the partial results are returned with a `timed_out: true` flag in the report.

**Accuracy of log analysis:**

Log analysis accuracy is directly tied to the quality of `data/ai-agents.json`. Any bot not in that list will not be counted. The community list currently covers 20 major AI crawlers, which represents the large majority of AI training traffic by volume.

False negatives (missed bots) occur when:
- A new crawler with an unlisted User-Agent appears
- A crawler uses a generic User-Agent or spoofs a browser UA
- The User-Agent pattern matching is too narrow for a variation of a known UA

---

## Policy Generation

### How robots.txt generation works (`collector/api/policy.py`)

**Pre-fill from existing robots.txt:**

The prefill endpoint fetches the domain's current robots.txt (through the SSRF guard) and passes it to `prefill_from_robots()`. This function:

1. Checks whether each known crawler's token appears in a `User-agent:` line
2. If explicitly mentioned: reads the rules to determine allow/block/inherit
3. Returns a decision map: `{crawler_name: "block" | "allow" | "inherit"}`

**robots.txt block generation:**

For each crawler the user has decided on:
- `block` → `User-agent: {token}\nDisallow: /\n`
- `allow` → `User-agent: {token}\nAllow: /\n`
- `inherit` → omitted (crawler follows your `User-agent: *` wildcard)

**llms.txt generation:**

The llms.txt format lists each crawler with its policy decision in a structured text format. This is an emerging standard (similar to robots.txt but designed for LLMs to parse) that allows AI systems to discover your content policy in machine-readable form.

---

## Crawler Watch (Upstream Sync)

### Data source

TrueTraffic syncs from the [ai-robots-txt project](https://github.com/ai-robots-txt/ai.robots.txt) — a community-maintained list of AI crawler User-Agent tokens maintained as a robots.txt file.

### Sync algorithm (`collector/api/crawlerwatch.py`)

```
1. Fetch upstream robots.txt from GitHub raw URL
2. Parse all User-agent tokens (excluding wildcard *)
3. Load most recent snapshot from DB (or None if first sync)
4. Compute diff:
   added   = upstream tokens − previous snapshot
   removed = previous snapshot − upstream tokens
5. If (added or removed) AND this is NOT the first sync:
   - Write CrawlerChangelog entry to DB
   - Send email to each subscriber listing added crawlers
6. Save today's snapshot to DB (idempotent — same-day re-sync updates in place)
```

**First-sync behaviour:** The first sync initialises the baseline without triggering alerts. This prevents a flood of emails when someone first deploys TrueTraffic with a fresh database.

**Same-day idempotency:** If the sync runs twice in one day, the second run updates the day's snapshot in place rather than creating a duplicate. The changelog is only written on the first diff detection per day.

### Email delivery

Emails are sent via the [Resend API](https://resend.com/). If `RESEND_API_KEY` is not set, the email is logged at INFO level and skipped — the service continues to function without email delivery. This allows running TrueTraffic locally without any email setup.

---

## Data Flow: Full Session Lifecycle

```
1. User visits yoursite.com
      │
      ├─ Browser loads hs.js from <script> tag in <head>
      │
      ├─ Script begins collecting signals immediately:
      │   • environment signals (webdriver, UA, plugins, languages) → sampled at load
      │   • pointer events → sampled for first 5 seconds
      │   • scroll events → sampled throughout session
      │
      └─ On pagehide / beforeunload:
            navigator.sendBeacon(COLLECTOR + '/beacon', JSON.stringify(signals))

2. Collector /beacon endpoint receives payload
      │
      ├─ Validates site_key (UUID format + DB lookup)
      ├─ Validates all fields (Pydantic, extra="forbid", field bounds)
      │
      ├─ Calls classifier(signals):
      │   R1 webdriver? → suspected_agent
      │   R2 headless_ua? → suspected_agent
      │   Accumulate weak: languages_empty, plugins_empty, ratio_bad, instant_scroll
      │   R7 had_pointer? → human (if weak ≤ 1) or unknown (if weak ≥ 2)
      │   weak ≥ 3 (no pointer)? → suspected_agent
      │   else → unknown
      │
      └─ Stores Visit record in SQLite (classification + all signals)

3. GET /stats/{site_key}?days=30
      │
      ├─ Loads all Visit records in date range
      ├─ Groups by classification (human / suspected_agent / unknown)
      ├─ Computes percentages
      ├─ Groups by day for trend chart
      │
      └─ Returns summary + daily breakdown → displayed in dashboard
```

---

## Database Schema

### Site
```
site_key  TEXT  PK  (UUID, unique index)
domain    TEXT       (lowercase, max 255)
created_at DATETIME
```

### Visit
```
id             INTEGER  PK
site_key       TEXT     (FK to Site, indexed)
classification TEXT     (human | suspected_agent | unknown)
webdriver      BOOL
headless_ua    BOOL
languages_empty BOOL
plugins_empty  BOOL
had_pointer    BOOL
pointer_count  INTEGER
scroll_depth_pct INTEGER
time_to_first_scroll_ms REAL
paint_to_interaction_ms REAL
viewport_w / viewport_h INTEGER
screen_w / screen_h     INTEGER
screen_viewport_ratio_ok BOOL
created_at     DATETIME  (indexed)
```

### LogReport
```
report_id   TEXT  PK  (UUID)
site_key    TEXT       (nullable — may not be linked)
status      TEXT       (pending | done | error)
report_json TEXT       (full analysis result as JSON)
error_msg   TEXT       (populated on error)
created_at  DATETIME
```

### Subscriber
```
id                 INTEGER  PK
email              TEXT     (unique)
unsubscribe_token  TEXT     (UUID, generated at insertion)
subscribed_at      DATETIME
```

### CrawlerSnapshot
```
snapshot_date      TEXT  (YYYY-MM-DD, unique — one per day)
agent_names_json   TEXT  (JSON array of known tokens on that date)
```

### CrawlerChangelog
```
id            INTEGER  PK
changed_at    DATETIME
added_json    TEXT     (JSON array of new tokens)
removed_json  TEXT     (JSON array of removed tokens)
```

---

## Security Architecture

### SSRF Protection

All outbound HTTP requests made by the server (robots.txt fetches, upstream sync) go through `shared/guards.py`. The guard:

1. Rejects non-HTTP/HTTPS schemes
2. Rejects non-standard ports (only 80 and 443)
3. Resolves the domain to an IP address
4. Rejects IPs in blocked ranges: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16` (includes AWS metadata at 169.254.169.254), `172.16.0.0/12`, `192.168.0.0/16`, `::1/128`, `fc00::/7`, `fe80::/10`
5. Caps response size at 1 MB
6. Validates redirect targets against the same rules

### Rate Limiting

All public endpoints are rate-limited per IP address via slowapi:

| Endpoint | Limit |
|----------|-------|
| `/check` (checker) | 30/minute |
| `/health` | 60/minute |
| `/sites` | 20/minute |
| `/beacon` | 120/minute |
| `/stats` | 60/minute |
| `/badge` | 60/minute |
| `/logs/upload` | 5/minute |
| `/logs/report` | 30/minute |
| `/policy/agents` | 60/minute |
| `/policy/prefill` | 10/minute |
| `/policy/generate` | 30/minute |
| `/crawlerwatch/subscribe` | 5/minute |
| `/crawlerwatch/unsubscribe` | 10/minute |
| `/crawlerwatch/changelog` | 30/minute |
| `/crawlerwatch/sync` | 1/hour |

### Input Validation

- All Pydantic models use `extra="forbid"` — unexpected fields in JSON payloads are rejected
- All numeric fields have explicit `ge` / `le` bounds
- Site keys are validated against a UUID regex before DB lookup
- Domain names are validated against a DNS-label regex before insertion
- Email addresses are validated against an RFC-compliant regex
- File extensions on upload are restricted to `.log`, `.txt`, `.csv`, `.gz`

---

## Accuracy Summary

| Feature | Accuracy | Primary limitation |
|---------|----------|--------------------|
| Robots.txt grade | Very high for compliant crawlers | Cannot detect bots that ignore robots.txt |
| Per-crawler status | High (uses same parser as crawlers) | Limited to bots in ai-agents.json |
| JS classification (webdriver/headless) | ~99% precision | Patched headless browsers can suppress these flags |
| JS classification (compound weak signals) | ~80% precision | Mobile browsers share some signals with headless |
| JS classification (overall human label) | ~95% precision | Bots simulating pointer events could fool it |
| Log analysis | Depends on ai-agents.json coverage | New crawlers with unknown UAs are missed |
| Bandwidth cost estimate | Exact for matched bots | Unmatched bots excluded from cost |

**False positive rate (human labelled as bot):** Very low (<1% estimated). The classifier requires either a definitive automation flag or 3+ weak signals without any pointer activity. Real humans almost always trigger pointer events.

**False negative rate (bot labelled as human or unknown):** Moderate (~20–40% of sophisticated bots end up as "unknown"). This is an intentional design decision — it is better to undercount bots than to incorrectly label a human session.
